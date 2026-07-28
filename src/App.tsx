import { useEffect, useState, type ComponentType } from 'react'
import {
  ArrowRight,
  Bell,
  Bookmark,
  Check,
  ChefHat,
  Clock3,
  Compass,
  Heart,
  Home,
  Leaf,
  MapPin,
  PackageOpen,
  Plus,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Star,
  UserRound,
  Users,
  Utensils,
  WalletCards,
  WandSparkles,
} from 'lucide-react'
import './App.css'

type Icon = ComponentType<{ size?: number; strokeWidth?: number }>
type Mode = 'recommend' | 'cook'
type Section = 'home' | 'groups' | 'explore' | 'saved' | 'profile'

const navigation: Array<{ id: Section; label: string; icon: Icon }> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'groups', label: 'Groups', icon: Users },
  { id: 'explore', label: 'Explore', icon: Compass },
  { id: 'saved', label: 'Saved', icon: Bookmark },
  { id: 'profile', label: 'Me', icon: UserRound },
]

const restaurantResults = [
  {
    name: 'Soi 38',
    category: 'Thai · Dine in',
    eta: '12 min away',
    price: '$$',
    match: '92% group match',
    description:
      'A lively neighbourhood spot with shareable plates, strong vegetarian choices, and the spicy food Jules keeps voting for.',
    signals: ['3 members saved Thai', 'Works for Maya’s budget', 'Open until 10:30'],
    tone: 'thai',
    initials: 'S38',
  },
  {
    name: 'Nori Table',
    category: 'Japanese · Delivery',
    eta: '28–35 min',
    price: '$$',
    match: '89% group match',
    description:
      'Reliable delivery, easy customisation, and enough variety for the group without making everyone browse for twenty minutes.',
    signals: ['Sam rated it 4.8', 'No shellfish options', 'Free group delivery'],
    tone: 'nori',
    initials: 'NT',
  },
]

const cookingResults = [
  {
    name: 'Ginger miso salmon bowls',
    category: '4 servings · One-pan plan',
    eta: '28 min',
    price: 'Uses 7 pantry items',
    match: 'Low-waste match',
    description:
      'Roast the salmon and greens together, warm the rice, then finish with a five-minute ginger miso dressing.',
    signals: ['Uses salmon tonight', 'High-protein', 'Only 2 items to buy'],
    tone: 'cook',
    initials: 'GM',
  },
]

const explorePosts = [
  {
    title: 'The 15-minute dumpling soup our group keeps making',
    author: 'Jules Lim',
    meta: '12 min read',
    likes: 284,
    tone: 'dumpling',
    tag: 'Quick dinner',
  },
  {
    title: 'Three quiet cafés for a long Saturday catch-up',
    author: 'Nadia K.',
    meta: 'Tiong Bahru',
    likes: 418,
    tone: 'cafe',
    tag: 'Places',
  },
  {
    title: 'What I order when everyone wants something different',
    author: 'Sam Koh',
    meta: 'Group-tested',
    likes: 197,
    tone: 'table',
    tag: 'Ordering',
  },
  {
    title: 'Six fridge staples that rescue a weeknight dinner',
    author: 'Mina P.',
    meta: 'Pantry guide',
    likes: 356,
    tone: 'pantry',
    tag: 'Cooking',
  },
]

function App() {
  const [mode, setMode] = useState<Mode>('recommend')
  const [section, setSection] = useState<Section>('home')
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [resultIndex, setResultIndex] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)

  const result =
    mode === 'recommend'
      ? restaurantResults[resultIndex % restaurantResults.length]
      : cookingResults[0]

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 3000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode)
    setSection('home')
    setGenerated(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const generate = () => {
    setGenerating(true)
    setGenerated(false)
    window.setTimeout(() => {
      setGenerating(false)
      setGenerated(true)
    }, 850)
  }

  const tryAnother = () => {
    if (mode === 'recommend') {
      setResultIndex((current) => current + 1)
      setNotice('A fresh option, using the same group context.')
      return
    }
    setNotice('The cooking plan has been refreshed around the same pantry.')
  }

  const changeSection = (nextSection: Section) => {
    setSection(nextSection)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="app">
      <header className="app-header">
        <button
          className="brand"
          type="button"
          onClick={() => changeSection('home')}
          aria-label="Go to FoodMind home"
        >
          <span className="brand-mark">
            <Leaf size={19} strokeWidth={2.6} />
          </span>
          <span>FoodMind</span>
        </button>

        <div className="mode-switch" role="group" aria-label="Choose recommendation mode">
          <button
            type="button"
            className={mode === 'recommend' ? 'active' : ''}
            aria-pressed={mode === 'recommend'}
            onClick={() => switchMode('recommend')}
          >
            <Utensils size={16} />
            <span>Eat out & delivery</span>
          </button>
          <button
            type="button"
            className={mode === 'cook' ? 'active' : ''}
            aria-pressed={mode === 'cook'}
            onClick={() => switchMode('cook')}
          >
            <ChefHat size={16} />
            <span>Cooking</span>
          </button>
        </div>

        <div className="header-actions">
          <button className="header-icon search-action" type="button" aria-label="Search">
            <Search size={19} />
          </button>
          <button className="header-icon" type="button" aria-label="Notifications">
            <Bell size={19} />
            <span className="notification-dot" />
          </button>
          <button
            className="avatar-button"
            type="button"
            onClick={() => changeSection('profile')}
            aria-label="Open Maya's profile"
          >
            M
          </button>
        </div>
      </header>

      <main>
        {section === 'home' && (
          <HomePage
            mode={mode}
            generating={generating}
            generated={generated}
            result={result}
            onGenerate={generate}
            onTryAnother={tryAnother}
            onNotice={setNotice}
            onOpenGroups={() => changeSection('groups')}
            onOpenExplore={() => changeSection('explore')}
          />
        )}
        {section === 'groups' && (
          <GroupsPage
            onNotice={setNotice}
            onGenerate={() => {
              setMode('recommend')
              setSection('home')
              setGenerated(false)
            }}
          />
        )}
        {section === 'explore' && <ExplorePage onNotice={setNotice} />}
        {section === 'saved' && <SavedPage onNotice={setNotice} />}
        {section === 'profile' && <ProfilePage onNotice={setNotice} />}
      </main>

      <nav className="bottom-navigation" aria-label="Primary navigation">
        {navigation.map(({ id, label, icon: NavigationIcon }) => (
          <button
            type="button"
            className={section === id ? 'active' : ''}
            aria-current={section === id ? 'page' : undefined}
            onClick={() => changeSection(id)}
            key={id}
          >
            <NavigationIcon size={20} strokeWidth={2.1} />
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
    </div>
  )
}

function HomePage({
  mode,
  generating,
  generated,
  result,
  onGenerate,
  onTryAnother,
  onNotice,
  onOpenGroups,
  onOpenExplore,
}: {
  mode: Mode
  generating: boolean
  generated: boolean
  result: (typeof restaurantResults)[number]
  onGenerate: () => void
  onTryAnother: () => void
  onNotice: (notice: string) => void
  onOpenGroups: () => void
  onOpenExplore: () => void
}) {
  const isRecommend = mode === 'recommend'

  return (
    <div className="page home-page">
      <section className="home-heading">
        <p className="eyebrow">{isRecommend ? 'Tonight · Kitchen Table' : 'Tonight · Your kitchen'}</p>
        <h1>{isRecommend ? 'Dinner, decided together.' : 'Cook with what you have.'}</h1>
        <p>
          {isRecommend
            ? 'One recommendation, shaped by your group—not another endless list.'
            : 'Turn your current pantry, time, and preferences into one practical cooking plan.'}
        </p>
      </section>

      <section className={`generator-card ${isRecommend ? 'recommend-mode' : 'cook-mode'}`}>
        <div className="generator-glow" aria-hidden="true" />
        <div className="generator-context">
          <div className="context-heading">
            <span className="context-icon">
              {isRecommend ? <Users size={19} /> : <PackageOpen size={19} />}
            </span>
            <div>
              <p>{isRecommend ? 'Recommending for' : 'Planning from'}</p>
              <strong>{isRecommend ? 'Kitchen Table · 4 people' : 'Maya’s pantry · 12 items'}</strong>
            </div>
            <button
              type="button"
              onClick={() =>
                onNotice(isRecommend ? 'Group context is ready to edit.' : 'Pantry inventory is ready to edit.')
              }
            >
              Edit
            </button>
          </div>

          <div className="member-signal">
            {isRecommend ? (
              <>
                <div className="avatar-stack" aria-label="Maya, Jules, Sam, and Nadia">
                  <span>MC</span>
                  <span>JL</span>
                  <span>SK</span>
                  <span>NK</span>
                </div>
                <p>
                  <strong>62 shared ratings</strong>
                  <span>Enough signal for tonight</span>
                </p>
              </>
            ) : (
              <>
                <div className="pantry-stack" aria-hidden="true">
                  <span>Salmon</span>
                  <span>Rice</span>
                  <span>Greens</span>
                </div>
                <p>
                  <strong>3 items should be used soon</strong>
                  <span>Salmon expires tomorrow</span>
                </p>
              </>
            )}
          </div>

          <div className="context-grid" aria-label="Recommendation context">
            <ContextItem icon={Clock3} label={isRecommend ? 'When' : 'Time'} value={isRecommend ? 'Tonight · 7 PM' : 'Under 35 min'} />
            <ContextItem icon={MapPin} label={isRecommend ? 'Range' : 'Serves'} value={isRecommend ? 'Within 3 km' : '4 people'} />
            <ContextItem icon={WalletCards} label={isRecommend ? 'Budget' : 'Extra spend'} value={isRecommend ? '$$ · about $25' : 'Under $12'} />
            <ContextItem icon={Sparkles} label="Must work for" value={isRecommend ? 'No shellfish' : 'High protein'} />
          </div>
        </div>

        <div className="generator-action">
          <span className="hero-symbol" aria-hidden="true">
            {isRecommend ? <MapPin size={34} /> : <ChefHat size={34} />}
          </span>
          <p className="generator-label">{isRecommend ? 'FoodMind recommendation' : 'FoodMind cooking plan'}</p>
          <h2>
            {isRecommend
              ? 'Ready for one place everyone can say yes to?'
              : 'Ready to turn those ingredients into dinner?'}
          </h2>
          <p>
            {isRecommend
              ? 'We combine personal history, group taste, distance, budget, and tonight’s constraints.'
              : 'We prioritise what expires soon, then balance effort, nutrition, and your group’s preferences.'}
          </p>
          <button className="generate-button" type="button" onClick={onGenerate} disabled={generating}>
            {generating ? (
              <>
                <span className="spinner" aria-hidden="true" />
                {isRecommend ? 'Finding your best match…' : 'Building your plan…'}
              </>
            ) : (
              <>
                <WandSparkles size={20} />
                {isRecommend ? 'Generate recommendation' : 'Generate cooking plan'}
                <ArrowRight size={18} />
              </>
            )}
          </button>
          <small>{isRecommend ? 'One strong answer, with reasons you can inspect.' : 'A complete plan, not just a recipe link.'}</small>
        </div>
      </section>

      {generated && (
        <section className="result-card" aria-live="polite">
          <div className={`result-visual ${result.tone}`} aria-hidden="true">
            <span>{result.initials}</span>
            <small>{isRecommend ? 'TONIGHT’S MATCH' : 'TONIGHT’S PLAN'}</small>
          </div>
          <div className="result-copy">
            <div className="result-topline">
              <span className="match-pill">
                <Sparkles size={14} /> {result.match}
              </span>
              <button
                className="save-button"
                type="button"
                onClick={() => onNotice(`${result.name} has been saved.`)}
                aria-label={`Save ${result.name}`}
              >
                <Bookmark size={18} />
              </button>
            </div>
            <p className="eyebrow">{result.category}</p>
            <h2>{result.name}</h2>
            <div className="result-meta">
              <span>
                <Clock3 size={15} /> {result.eta}
              </span>
              <span>{result.price}</span>
            </div>
            <p className="result-description">{result.description}</p>
            <div className="signal-list">
              {result.signals.map((signal) => (
                <span key={signal}>
                  <Check size={14} /> {signal}
                </span>
              ))}
            </div>
            <div className="result-actions">
              <button
                className="primary-action"
                type="button"
                onClick={() =>
                  onNotice(isRecommend ? `${result.name} is ready to share with the group.` : 'Cooking plan added to tonight.')
                }
              >
                {isRecommend ? <Send size={17} /> : <ChefHat size={17} />}
                {isRecommend ? 'Share with group' : 'Start cooking'}
              </button>
              <button className="secondary-action" type="button" onClick={onTryAnother}>
                <RotateCcw size={16} /> Try another
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="support-grid">
        <section className="group-card">
          <div className="section-topline">
            <div>
              <p className="eyebrow">Core group</p>
              <h2>Kitchen Table</h2>
            </div>
            <button className="text-button" type="button" onClick={onOpenGroups}>
              Open group <ArrowRight size={15} />
            </button>
          </div>
          <p className="section-support">Shared tastes, saved places, votes, and recommendations live here.</p>
          <div className="group-members">
            <Member initials="MC" name="You" signal="22 ratings" tone="mint" />
            <Member initials="JL" name="Jules" signal="18 ratings" tone="peach" />
            <Member initials="SK" name="Sam" signal="14 ratings" tone="lilac" />
            <Member initials="NK" name="Nadia" signal="8 ratings" tone="butter" />
          </div>
          <div className="group-activity">
            <span className="activity-icon">
              <Star size={18} />
            </span>
            <p>
              <strong>Strongest shared signal</strong>
              <span>Casual Asian food, $–$$, easy sharing</span>
            </p>
          </div>
        </section>

        <section className="learn-card">
          <p className="eyebrow">Why it gets better</p>
          <h2>Every choice teaches FoodMind.</h2>
          <div className="learn-list">
            <LearnItem number="01" title="Your history" detail="Ratings, saves, skips, and repeat orders" />
            <LearnItem number="02" title="Group overlap" detail="Where everyone’s preferences intersect" />
            <LearnItem number="03" title="Tonight’s context" detail="Budget, distance, time, and constraints" />
          </div>
        </section>
      </div>

      <section className="explore-preview">
        <div className="section-topline">
          <div>
            <p className="eyebrow">From Explore</p>
            <h2>Ideas worth passing around</h2>
          </div>
          <button className="text-button" type="button" onClick={onOpenExplore}>
            Browse posts <ArrowRight size={15} />
          </button>
        </div>
        <div className="preview-posts">
          {explorePosts.slice(0, 3).map((post) => (
            <PostCard post={post} onNotice={onNotice} key={post.title} compact />
          ))}
        </div>
      </section>
    </div>
  )
}

function GroupsPage({
  onNotice,
  onGenerate,
}: {
  onNotice: (notice: string) => void
  onGenerate: () => void
}) {
  return (
    <div className="page section-page">
      <header className="section-page-heading">
        <div>
          <p className="eyebrow">Shared decisions</p>
          <h1>Your groups</h1>
          <p>Build shared taste over time, then let FoodMind find the overlap.</p>
        </div>
        <button className="primary-action" type="button" onClick={() => onNotice('Invite link copied.')}>
          <Plus size={17} /> Create group
        </button>
      </header>

      <section className="featured-group">
        <div className="featured-group-copy">
          <span className="group-label">
            <Users size={15} /> Your most active group
          </span>
          <h2>Kitchen Table</h2>
          <p>4 members · 62 shared ratings · 11 saved places</p>
          <div className="avatar-stack large">
            <span>MC</span>
            <span>JL</span>
            <span>SK</span>
            <span>NK</span>
          </div>
          <button className="generate-button small" type="button" onClick={onGenerate}>
            <WandSparkles size={18} /> Recommend for this group
          </button>
        </div>
        <div className="vote-card">
          <p className="eyebrow">Open vote · Dinner Friday</p>
          <h3>Which direction feels right?</h3>
          <VoteRow label="Thai sharing plates" votes={3} total={4} />
          <VoteRow label="Japanese delivery" votes={2} total={4} />
          <VoteRow label="Cook at Maya’s" votes={1} total={4} />
          <button className="secondary-action full" type="button" onClick={() => onNotice('Your vote is recorded.')}>
            Add your vote
          </button>
        </div>
      </section>

      <div className="group-list-grid">
        <GroupListCard title="Lunch crew" members="5 members" signal="Fast lunches under $18" color="coral" />
        <GroupListCard title="Family Sunday" members="6 members" signal="Quiet spaces, vegetarian-friendly" color="sage" />
        <button className="new-group-card" type="button" onClick={() => onNotice('New group flow opened.')}>
          <Plus size={22} />
          <strong>Start another group</strong>
          <span>Invite people and build a shared taste profile.</span>
        </button>
      </div>
    </div>
  )
}

function ExplorePage({ onNotice }: { onNotice: (notice: string) => void }) {
  return (
    <div className="page section-page">
      <header className="section-page-heading explore-heading">
        <div>
          <p className="eyebrow">Community notes</p>
          <h1>Explore what people are eating.</h1>
          <p>Short reviews, useful lists, and honest food ideas from people you trust.</p>
        </div>
        <label className="explore-search">
          <Search size={18} />
          <span className="sr-only">Search posts</span>
          <input placeholder="Search places, dishes, or lists" />
        </label>
      </header>

      <div className="topic-row" aria-label="Explore topics">
        {['For you', 'Near me', 'Quick dinner', 'Group-tested', 'Cooking', 'Cafés'].map((topic, index) => (
          <button className={index === 0 ? 'active' : ''} type="button" key={topic}>
            {topic}
          </button>
        ))}
      </div>

      <section className="post-grid">
        {explorePosts.concat(explorePosts.slice(0, 2)).map((post, index) => (
          <PostCard
            post={{ ...post, title: index > 3 ? `${post.title} — saved edition` : post.title }}
            onNotice={onNotice}
            key={`${post.title}-${index}`}
          />
        ))}
      </section>
    </div>
  )
}

function SavedPage({ onNotice }: { onNotice: (notice: string) => void }) {
  return (
    <div className="page section-page">
      <header className="section-page-heading">
        <div>
          <p className="eyebrow">Your shortlist</p>
          <h1>Saved for the right moment.</h1>
          <p>Places, posts, and cooking ideas you or your groups want to try.</p>
        </div>
      </header>
      <div className="saved-grid">
        {restaurantResults.map((item) => (
          <article className="saved-card" key={item.name}>
            <div className={`saved-visual ${item.tone}`}>{item.initials}</div>
            <div>
              <p className="eyebrow">{item.category}</p>
              <h2>{item.name}</h2>
              <p>{item.description}</p>
              <button className="text-button" type="button" onClick={() => onNotice(`${item.name} is ready to recommend.`)}>
                Use in a recommendation <ArrowRight size={15} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function ProfilePage({ onNotice }: { onNotice: (notice: string) => void }) {
  return (
    <div className="page section-page">
      <header className="profile-heading">
        <span className="profile-avatar">M</span>
        <div>
          <p className="eyebrow">Taste profile</p>
          <h1>Maya Chen</h1>
          <p>FoodMind has learned from 48 ratings, 16 saves, and 9 group decisions.</p>
        </div>
      </header>
      <div className="profile-grid">
        <section className="profile-card">
          <p className="eyebrow">Strong signals</p>
          <h2>Your taste, at a glance</h2>
          <div className="taste-tags">
            {['Spicy', 'Japanese', 'High protein', 'Casual', '$–$$', 'Under 30 min'].map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          <button className="secondary-action full" type="button" onClick={() => onNotice('Preference editor opened.')}>
            Edit preferences
          </button>
        </section>
        <section className="profile-card">
          <p className="eyebrow">Learning controls</p>
          <h2>You stay in control.</h2>
          <p>Review or remove the signals FoodMind uses for recommendations.</p>
          <button className="secondary-action full" type="button" onClick={() => onNotice('Recommendation history opened.')}>
            Review recommendation history
          </button>
        </section>
      </div>
    </div>
  )
}

function ContextItem({
  icon: ContextIcon,
  label,
  value,
}: {
  icon: Icon
  label: string
  value: string
}) {
  return (
    <div className="context-item">
      <ContextIcon size={17} />
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </div>
  )
}

function Member({
  initials,
  name,
  signal,
  tone,
}: {
  initials: string
  name: string
  signal: string
  tone: string
}) {
  return (
    <div className="member">
      <span className={`member-avatar ${tone}`}>{initials}</span>
      <strong>{name}</strong>
      <small>{signal}</small>
    </div>
  )
}

function LearnItem({ number, title, detail }: { number: string; title: string; detail: string }) {
  return (
    <div className="learn-item">
      <span>{number}</span>
      <p>
        <strong>{title}</strong>
        <small>{detail}</small>
      </p>
    </div>
  )
}

function PostCard({
  post,
  onNotice,
  compact = false,
}: {
  post: (typeof explorePosts)[number]
  onNotice: (notice: string) => void
  compact?: boolean
}) {
  return (
    <article className={`post-card ${compact ? 'compact' : ''}`}>
      <button
        className={`post-visual ${post.tone}`}
        type="button"
        onClick={() => onNotice(`Opening “${post.title}”.`)}
        aria-label={`Open post: ${post.title}`}
      >
        <span className="post-tag">{post.tag}</span>
        <span className="post-shape shape-a" />
        <span className="post-shape shape-b" />
        <span className="post-shape shape-c" />
      </button>
      <div className="post-copy">
        <h3>{post.title}</h3>
        <div className="post-meta">
          <span className="post-author">
            <span>{post.author.charAt(0)}</span>
            {post.author}
          </span>
          <button type="button" onClick={() => onNotice('Saved to your food ideas.')}>
            <Heart size={14} /> {post.likes}
          </button>
        </div>
      </div>
    </article>
  )
}

function VoteRow({ label, votes, total }: { label: string; votes: number; total: number }) {
  return (
    <div className="vote-row">
      <div>
        <span>{label}</span>
        <strong>{votes}</strong>
      </div>
      <div className="vote-track">
        <span style={{ width: `${(votes / total) * 100}%` }} />
      </div>
    </div>
  )
}

function GroupListCard({
  title,
  members,
  signal,
  color,
}: {
  title: string
  members: string
  signal: string
  color: string
}) {
  return (
    <article className={`group-list-card ${color}`}>
      <span className="group-list-icon">
        <Users size={20} />
      </span>
      <p className="eyebrow">{members}</p>
      <h2>{title}</h2>
      <p>{signal}</p>
      <button type="button" aria-label={`Open ${title}`}>
        <ArrowRight size={17} />
      </button>
    </article>
  )
}

export default App
