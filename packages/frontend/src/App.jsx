import { useState } from 'react';
import { CssBaseline } from '@mui/material';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import SpaRoundedIcon from '@mui/icons-material/SpaRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Ingredients from './Ingredients';
import Recipes from './Recipes';
import Shelf from './Shelf';
import CalendarBoard from './CalendarBoard';
import './styles.css';

export default function App() {
  const [view, setView] = useState('calendar');
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <CssBaseline />
      <div className="app-shell">
        <header className="topbar">
          <div className="brand" aria-label="Gather home">
            <span className="brand-mark"><SpaRoundedIcon fontSize="small" /></span>
            <span>gather<span className="brand-dot">.</span></span>
          </div>
          <div className="topbar-note">A little more time for the good stuff.</div>
          <span className="topbar-pill">Your kitchen, organized</span>
        </header>

        <main className="main-content">
          <nav className="section-nav" aria-label="Planner sections">
            <button className={view === 'calendar' ? 'nav-active' : 'nav-link'} type="button" onClick={() => setView('calendar')} aria-current={view === 'calendar' ? 'page' : undefined}><CalendarMonthRoundedIcon fontSize="small" /> Weekly planner</button>
            <button className={view === 'ingredients' ? 'nav-active' : 'nav-link'} type="button" onClick={() => setView('ingredients')} aria-current={view === 'ingredients' ? 'page' : undefined}>Ingredients</button>
            <button className={view === 'shelf' ? 'nav-active' : 'nav-link'} type="button" onClick={() => setView('shelf')} aria-current={view === 'shelf' ? 'page' : undefined}>Shelf</button>
            <button className={view === 'recipes' ? 'nav-active' : 'nav-link'} type="button" onClick={() => setView('recipes')} aria-current={view === 'recipes' ? 'page' : undefined}>Recipes</button>
          </nav>

          {view === 'calendar' ? (
          <>
          <section className="hero" aria-labelledby="hero-heading">
            <div className="hero-content">
              <p className="eyebrow">THE WEEKLY TABLE</p>
              <h1 id="hero-heading">Your week, <em>well planned.</em></h1>
              <p className="hero-description">Good meals start with a little planning. Keep your recipes, ingredients and grocery trips in one calm place.</p>
            </div>
            <div className="hero-art" aria-hidden="true"><span>✦</span><span>✺</span><span>✦</span></div>
          </section>

          <CalendarBoard />

          <aside className="getting-started">
            <span className="getting-started-icon"><SpaRoundedIcon /></span>
            <div>
              <h2>A good plan starts with good ingredients.</h2>
              <p>Start by adding an ingredient, then build recipes and plan your week. No sample meals to clear out — this space is yours.</p>
            </div>
            <button type="button" className="getting-started-link" onClick={() => setView('ingredients')}>
              Start with ingredients <ArrowForwardRoundedIcon aria-hidden="true" />
            </button>
          </aside>
          </>
          ) : view === 'ingredients' ? <Ingredients /> : view === 'shelf' ? <Shelf /> : <Recipes />}
        </main>
        <footer className="footer">Gather · Make more of what you have.</footer>
      </div>
    </QueryClientProvider>
  );
}