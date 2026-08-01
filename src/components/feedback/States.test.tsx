import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ApiError } from '../../lib/api/client'
import { EmptyState, ErrorState, FallbackBanner, LoadingState } from './States'

describe('data states', () => {
  it('announces loading and fallback states', () => {
    const { rerender } = render(<LoadingState label="Loading meals…" />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading meals')
    rerender(<FallbackBanner message="Rules-based result shown." />)
    expect(screen.getByRole('status')).toHaveTextContent('Reliable fallback used')
  })

  it('keeps empty and permission states distinct', () => {
    const { rerender } = render(<EmptyState title="No records" message="Add your first one." />)
    expect(screen.getByRole('heading', { name: 'No records' })).toBeInTheDocument()
    rerender(<ErrorState error={new ApiError(new Response('', { status: 403 }), { message: 'Private.' })} />)
    expect(screen.getByRole('heading', { name: 'This stays private' })).toBeInTheDocument()
  })
})
