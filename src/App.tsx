import { useEffect, useState, type ComponentType } from 'react'
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookmarkPlus,
  CalendarDays,
  Check,
  ChefHat,
  Clock3,
  Compass,
  Flame,
  Home,
  Leaf,
  MessageCircle,
  Plus,
  RefreshCcw,
  Search,
  Sparkles,
  Star,
  Users,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import './App.css'

type Icon = ComponentType<{ size?: number; strokeWidth?: number }>

const navigation: Array<{ label: string; icon: Icon }> = [
  { label: 'Today', icon: Home },
  { label: 'Discover', icon: Compass },
  { label: 'My plan', icon: CalendarDays },
  { label: 'Groups', icon: Users },
  { label: 'Progress', icon: BarChart3 },
]

const recommendations = [
  {
    eyebrow: 'A good fit for tonight',
    title: 'Miso salmon rice bowl',
    description:
      'Bright, comforting, and built around the salmon already in your fridge.',
    time: '25 min',
    calories: '560 kcal',
    protein: '38g protein',
    reason: 'Matches your high-protein goal',
    ingredients: ['salmon', 'edamame', 'brown rice'],
    color: 'coral',
  },
  {
    eyebrow: 'Quick weeknight idea',
    title: 'Ginger tofu noodle salad',
    description:
      'Crunchy vegetables, a punchy dressing, and almost no washing up.',
    time: '20 min',
    calories: '510 kcal',
    protein: '27g protein',
    reason: 'Uses 4 items you already have',
    ingredients: ['tofu', 'noodles', 'cucumber'],
    color: 'lime',
  },
  {
    eyebrow: 'A cozy fallback',
    title: 'Tomato lentil shakshuka',
    description:
      'A one-pan dinner that keeps your week balanced without feeling worthy.',
    time: '30 min',
    calories: '485 kcal',
    protein: '24g protein',
    reason: 'High fibre and under your budget',
    ingredients: ['lentils', 'eggs', 'tomatoes'],
    color: 'amber',
  },
]

const meals = [
  {
    time: '8:10',
    period: 'AM',
    title: 'Greek yoghurt & berries',
    meta: 'Breakfast · 320 kcal',
    tone: 'berry',
    emoji: '◒',
  },
  {
    time: '12:35',
    period: 'PM',
    title: 'Chicken soba salad',
    meta: 'Lunch · 540 kcal',
    tone: 'leaf',
    emoji: '≋',
  },
]

function App() {
  const [recommendationIndex, setRecommendationIndex] = useState(0)
  const [planned, setPlanned] = useState(false)
  const [modal, setModal] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const recommendation = recommendations[recommendationIndex]

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 3200)
    return () => window.clearTimeout(timer)
  }, [notice])

  const chooseAnother = () => {
    setPlanned(false)
    setRecommendationIndex((current) => (current + 1) % recommendations.length)
    setNotice('Fresh idea, based on the same preferences.')
  }

  const addToPlan = () => {
    setPlanned(true)
    setNotice(`${recommendation.title} is in your dinner plan.`)
  }

  const openFlow = (title: string) => setModal(title)

  const completeFlow = () => {
    const action = modal
    setModal(null)
    setNotice(`${action} saved — nice work, Maya.`)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <a className="brand" href="#main-content" aria-label="FoodMind home">
          <span className="brand-mark">
            <Leaf size={20} strokeWidth={2.6} />
          </span>
          <span>FoodMind</span>
        </a>

        <nav className="side-navigation">
          {navigation.map(({ label, icon: NavigationIcon }, index) => (
            <button
              className={`nav-item ${index === 0 ? 'active' : ''}`}
              type="button"
              key={label}
              aria-current={index === 0 ? 'page' : undefined}
              onClick={() =>
                index === 0
                  ? window.scrollTo({ top: 0, behavior: 'smooth' })
                  : setNotice(
                      `${label} is mapped into the UX system; this prototype spotlights Today.`,
                    )
              }
            >
              <NavigationIcon size={20} strokeWidth={2} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-tip">
          <div className="tip-icon">
            <Sparkles size={18} />
          </div>
          <p>FoodMind gets sharper each time you log or rate a meal.</p>
          <button type="button" onClick={() => openFlow('Tune my preferences')}>
            Tune my preferences <ArrowRight size={14} />
          </button>
        </div>

        <button
          className="profile-chip"
          type="button"
          onClick={() => openFlow('Profile')}
          aria-label="Open Maya's profile"
        >
          <span className="avatar">M</span>
          <span>
            <strong>Maya Chen</strong>
            <small>Free plan</small>
          </span>
          <span className="profile-arrow">›</span>
        </button>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark">
              <Leaf size={18} strokeWidth={2.6} />
            </span>
            <span>FoodMind</span>
          </div>

          <label className="search">
            <Search size={18} />
            <span className="sr-only">Search FoodMind</span>
            <input placeholder="Search meals, recipes, or people" />
            <kbd>⌘ K</kbd>
          </label>

          <div className="topbar-actions">
            <button className="icon-button" type="button" aria-label="Notifications">
              <Bell size={19} />
              <span className="notification-dot" />
            </button>
            <button
              className="primary-button top-log"
              type="button"
              onClick={() => openFlow('Log a meal')}
            >
              <Plus size={18} />
              Log a meal
            </button>
          </div>
        </header>

        <main id="main-content" className="main-content">
          <section className="page-heading">
            <div>
              <p className="eyebrow">Tuesday, 28 July</p>
              <h1>Good afternoon, Maya.</h1>
              <p className="page-subtitle">
                You’re on track today. Let’s make dinner the easy part.
              </p>
            </div>
            <button
              className="primary-button mobile-log"
              type="button"
              onClick={() => openFlow('Log a meal')}
            >
              <Plus size={18} />
              Log meal
            </button>
          </section>

          <div className="dashboard-grid">
            <div className="dashboard-main">
              <section className="recommendation-card" aria-labelledby="dinner-title">
                <div className={`food-visual ${recommendation.color}`} aria-hidden="true">
                  <span className="plate">
                    <span className="food-piece piece-one" />
                    <span className="food-piece piece-two" />
                    <span className="food-piece piece-three" />
                    <span className="food-garnish" />
                  </span>
                  <span className="visual-label">DINNER · FOR YOU</span>
                </div>

                <div className="recommendation-copy">
                  <div>
                    <p className="card-eyebrow">
                      <Sparkles size={15} />
                      {recommendation.eyebrow}
                    </p>
                    <h2 id="dinner-title">{recommendation.title}</h2>
                    <p className="recommendation-description">
                      {recommendation.description}
                    </p>
                  </div>

                  <div className="meal-meta" aria-label="Meal details">
                    <span>
                      <Clock3 size={15} /> {recommendation.time}
                    </span>
                    <span>
                      <Flame size={15} /> {recommendation.calories}
                    </span>
                    <span>{recommendation.protein}</span>
                  </div>

                  <div className="why-row">
                    <Check size={15} />
                    <span>{recommendation.reason}</span>
                  </div>

                  <div className="recommendation-actions">
                    <button
                      className={`light-button ${planned ? 'confirmed' : ''}`}
                      type="button"
                      onClick={addToPlan}
                    >
                      {planned ? <Check size={17} /> : <ChefHat size={17} />}
                      {planned ? 'Added to tonight' : 'Make this tonight'}
                    </button>
                    <button className="ghost-light-button" type="button" onClick={chooseAnother}>
                      <RefreshCcw size={16} />
                      Something else
                    </button>
                  </div>
                </div>
              </section>

              <section className="quick-section" aria-labelledby="quick-actions-title">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Shortcuts</p>
                    <h2 id="quick-actions-title">What do you need?</h2>
                  </div>
                </div>
                <div className="quick-grid">
                  <QuickAction
                    icon={UtensilsCrossed}
                    title="Log food"
                    description="Add a meal in seconds"
                    tone="mint"
                    onClick={() => openFlow('Log a meal')}
                  />
                  <QuickAction
                    icon={ChefHat}
                    title="Plan dinner"
                    description="Use what you have"
                    tone="peach"
                    onClick={() => openFlow('Plan dinner')}
                  />
                  <QuickAction
                    icon={MessageCircle}
                    title="Ask FoodMind"
                    description="Talk through a choice"
                    tone="lilac"
                    onClick={() => openFlow('Ask FoodMind')}
                  />
                  <QuickAction
                    icon={BookmarkPlus}
                    title="Want to try"
                    description="Save something tasty"
                    tone="butter"
                    onClick={() => openFlow('Want to try')}
                  />
                </div>
              </section>

              <section className="card today-card" aria-labelledby="today-title">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">28 July</p>
                    <h2 id="today-title">Today’s meals</h2>
                  </div>
                  <button className="text-button" type="button" onClick={() => openFlow('Meal history')}>
                    See history <ArrowRight size={15} />
                  </button>
                </div>

                <div className="meal-list">
                  {meals.map((meal) => (
                    <div className="meal-row" key={meal.title}>
                      <div className="meal-time">
                        <strong>{meal.time}</strong>
                        <span>{meal.period}</span>
                      </div>
                      <div className={`meal-thumbnail ${meal.tone}`} aria-hidden="true">
                        {meal.emoji}
                      </div>
                      <div className="meal-name">
                        <strong>{meal.title}</strong>
                        <span>{meal.meta}</span>
                      </div>
                      <button
                        className="row-action"
                        type="button"
                        aria-label={`Open ${meal.title}`}
                        onClick={() => openFlow(meal.title)}
                      >
                        ›
                      </button>
                    </div>
                  ))}
                  <button
                    className="add-inline"
                    type="button"
                    onClick={() => openFlow('Log a meal')}
                  >
                    <Plus size={17} /> Add a snack or drink
                  </button>
                </div>
              </section>
            </div>

            <aside className="dashboard-aside" aria-label="Weekly insights">
              <section className="card balance-card" aria-labelledby="balance-title">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Weekly balance</p>
                    <h2 id="balance-title">A steady week</h2>
                  </div>
                  <button className="icon-button subtle" type="button" aria-label="Weekly balance options">
                    ···
                  </button>
                </div>

                <div className="score-wrap">
                  <div className="score-ring" role="img" aria-label="Weekly balance score 78 out of 100">
                    <div>
                      <strong>78</strong>
                      <span>of 100</span>
                    </div>
                  </div>
                  <div className="score-copy">
                    <strong>Nicely balanced</strong>
                    <p>More vegetables at dinner would lift your variety.</p>
                  </div>
                </div>

                <div className="progress-list">
                  <Progress label="Protein" value="82%" percentage={82} tone="green" />
                  <Progress label="Plants" value="6 / 8" percentage={75} tone="orange" />
                  <Progress label="Water" value="5 / 7" percentage={71} tone="blue" />
                </div>

                <button className="secondary-button" type="button" onClick={() => openFlow('Weekly insights')}>
                  View weekly insights <ArrowRight size={16} />
                </button>
              </section>

              <section className="card friend-card" aria-labelledby="friend-title">
                <div className="friend-top">
                  <div className="avatar-stack" aria-hidden="true">
                    <span>JL</span>
                    <span>SK</span>
                    <span>AN</span>
                  </div>
                  <span className="live-label">3 new</span>
                </div>
                <p className="eyebrow">Kitchen table</p>
                <h2 id="friend-title">Your group is cooking</h2>
                <p>Jules shared a 15-minute dumpling soup. Sam saved it too.</p>
                <button className="text-button" type="button" onClick={() => openFlow('Kitchen table')}>
                  See group activity <ArrowRight size={15} />
                </button>
              </section>

              <section className="micro-card">
                <span className="micro-icon">
                  <Star size={18} />
                </span>
                <div>
                  <strong>Small win</strong>
                  <p>You’ve cooked at home 3 times this week.</p>
                </div>
              </section>
            </aside>
          </div>
        </main>
      </div>

      <nav className="mobile-navigation" aria-label="Mobile navigation">
        {navigation.map(({ label, icon: NavigationIcon }, index) => (
          <button
            type="button"
            className={index === 0 ? 'active' : ''}
            aria-current={index === 0 ? 'page' : undefined}
            key={label}
            onClick={() =>
              index === 0
                ? window.scrollTo({ top: 0, behavior: 'smooth' })
                : setNotice(`${label} is the next mapped screen in this UX prototype.`)
            }
          >
            <NavigationIcon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {notice && (
        <div className="toast" role="status" aria-live="polite">
          <Check size={17} />
          {notice}
        </div>
      )}

      {modal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setModal(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              onClick={() => setModal(null)}
              aria-label="Close dialog"
            >
              <X size={20} />
            </button>
            <span className="modal-icon">
              {modal === 'Ask FoodMind' ? <MessageCircle size={22} /> : <Sparkles size={22} />}
            </span>
            <p className="eyebrow">Quick flow preview</p>
            <h2 id="modal-title">{modal}</h2>
            <p>
              {modal === 'Ask FoodMind'
                ? 'What are you deciding? FoodMind can compare options using your goals and recent meals.'
                : 'The full flow keeps the first decision simple and asks for detail only when it helps.'}
            </p>
            <label>
              <span>{modal === 'Ask FoodMind' ? 'Your question' : 'Add a note (optional)'}</span>
              <input
                autoFocus
                placeholder={
                  modal === 'Ask FoodMind'
                    ? 'Is pasta or rice a better fit tonight?'
                    : 'Anything you want to remember?'
                }
              />
            </label>
            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button className="primary-button" type="button" onClick={completeFlow}>
                {modal === 'Ask FoodMind' ? 'Start chat' : 'Save'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function QuickAction({
  icon: ActionIcon,
  title,
  description,
  tone,
  onClick,
}: {
  icon: Icon
  title: string
  description: string
  tone: string
  onClick: () => void
}) {
  return (
    <button className="quick-action" type="button" onClick={onClick}>
      <span className={`quick-icon ${tone}`}>
        <ActionIcon size={21} strokeWidth={2} />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <span className="quick-arrow">›</span>
    </button>
  )
}

function Progress({
  label,
  value,
  percentage,
  tone,
}: {
  label: string
  value: string
  percentage: number
  tone: string
}) {
  return (
    <div className="progress-row">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="progress-track" aria-hidden="true">
        <span className={tone} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}

export default App
