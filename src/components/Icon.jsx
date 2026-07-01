/* Athena icon helper — renders any Lucide icon by its PascalCase name.
   Faithful replacement for the UI-kit's window.Icon (which read the Lucide
   UMD build); here it resolves against lucide-react's `icons` record so
   only the icons actually used get bundled. */
import { icons } from 'lucide-react';

export function Icon({ name, size = 18, strokeWidth = 1.85, style, ...rest }) {
  const Cmp = icons[name];
  if (!Cmp) return null;
  return (
    <Cmp
      size={size}
      strokeWidth={strokeWidth}
      style={{ flex: 'none', display: 'block', ...style }}
      {...rest}
    />
  );
}

export default Icon;
