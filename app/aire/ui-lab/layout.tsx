import "./_theme.css"

// Inline blocking script: reads localStorage + data-default-theme on the
// .ui-lab-scope container, applies data-theme attribute before first paint to
// avoid FOUC. Each concept page sets data-default-theme on its scope wrapper.
const THEME_BOOTSTRAP = `
(function(){try{
  var root=document.querySelector('.ui-lab-scope');
  if(!root)return;
  var stored=null;try{stored=localStorage.getItem('aire-theme')}catch(e){}
  var def=root.getAttribute('data-default-theme')||'nocturne';
  var t=(stored==='daylight'||stored==='nocturne')?stored:def;
  root.setAttribute('data-theme',t);
}catch(e){}})();
`

export default function UiLabLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      {/* Runs after the scope element mounts in DOM but before paint, avoiding
          the brief flash of the default-attribute'd theme before JS swaps it. */}
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
    </>
  )
}
