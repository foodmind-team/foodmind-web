import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RegisterPage } from './AuthRoutes'

const registerAccount = vi.fn()

vi.mock('../app/providers/AuthProvider', () => ({
  useAuth: () => ({ register: registerAccount }),
}))

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<div>Registered</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function fillRegistration() {
  await userEvent.type(screen.getByLabelText('Display name'), 'Privacy Tester')
  await userEvent.type(screen.getByLabelText('Email'), 'privacy@example.test')
  await userEvent.type(screen.getByLabelText('Password'), 'privacy-password')
}

describe('registration privacy consent', () => {
  beforeEach(() => registerAccount.mockReset())

  it('blocks registration until the user explicitly agrees', async () => {
    renderRegister()
    await fillRegistration()

    await userEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('You must agree before creating an account.')
    expect(registerAccount).not.toHaveBeenCalled()
  })

  it('registers after consent without adding a private API field', async () => {
    registerAccount.mockResolvedValue(undefined)
    renderRegister()
    await fillRegistration()
    await userEvent.click(screen.getByRole('checkbox', { name: /I agree that FoodMind may collect/i }))

    await userEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText('Registered')).toBeInTheDocument()
    expect(registerAccount).toHaveBeenCalledWith(expect.objectContaining({
      email: 'privacy@example.test',
      displayName: 'Privacy Tester',
      deviceLabel: 'FoodMind Web',
    }))
    expect(registerAccount.mock.calls[0][0]).not.toHaveProperty('privacyConsentAccepted')
  })
})
