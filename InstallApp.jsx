import { useEffect, useState } from 'react';

// "Install the app" — Android/desktop use the browser prompt; iPhone gets the Share → Add to Home Screen steps.
export default function InstallApp({ compact }) {
  const [prompt, setPrompt] = useState(null);
  const [iosHelp, setIosHelp] = useState(false);
  const [installed, setInstalled] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches);
  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setPrompt(e); };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  if (installed) return null;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  if (!prompt && !ios) return null;
  return (
    <div className={compact ? '' : 'install'}>
      <button type="button" className="ul" onClick={async () => {
        if (prompt) { prompt.prompt(); await prompt.userChoice.catch(() => null); setPrompt(null); } else setIosHelp(!iosHelp);
      }}>Install the ArchMentor app</button>
      {iosHelp && <p className="small muted mt-8">On iPhone: tap the Share button in Safari, then “Add to Home Screen”.</p>}
    </div>
  );
}
