/**
 * Skip link component for accessibility
 * Allows keyboard users to skip navigation and jump to main content
 */

interface SkipLinkProps {
  targetId: string;
  label?: string;
}

/**
 * Skip link that appears on focus for keyboard navigation
 * Should be placed at the very beginning of the page
 */
export function SkipLink({ targetId, label = 'Skip to main content' }: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[9999] focus:rounded-md focus:bg-teams-purple focus:px-4 focus:py-2 focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-teams-purple"
    >
      {label}
    </a>
  );
}

/**
 * Skip links container for multiple skip targets
 */
interface SkipLinksProps {
  links: Array<{
    targetId: string;
    label: string;
  }>;
}

export function SkipLinks({ links }: SkipLinksProps) {
  if (links.length === 0) return null;

  return (
    <nav aria-label="Skip links" className="sr-only focus-within:not-sr-only">
      <ul className="fixed left-4 top-4 z-[9999] flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.targetId}>
            <a
              href={`#${link.targetId}`}
              className="sr-only focus:not-sr-only focus:block focus:rounded-md focus:bg-teams-purple focus:px-4 focus:py-2 focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-teams-purple"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Visually hidden component for screen reader only content
 */
interface VisuallyHiddenProps {
  children: React.ReactNode;
  as?: 'span' | 'div' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

export function VisuallyHidden({ children, as: Component = 'span' }: VisuallyHiddenProps) {
  return <Component className="sr-only">{children}</Component>;
}

/**
 * Live region for announcing dynamic content to screen readers
 */
interface LiveRegionProps {
  children: React.ReactNode;
  politeness?: 'polite' | 'assertive';
  atomic?: boolean;
}

export function LiveRegion({
  children,
  politeness = 'polite',
  atomic = true,
}: LiveRegionProps) {
  return (
    <div
      aria-live={politeness}
      aria-atomic={atomic}
      className="sr-only"
    >
      {children}
    </div>
  );
}
