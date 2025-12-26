/**
 * Loading spinner component
 */

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 rounded-full border-4 border-gray-200 dark:border-gray-700"></div>
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-teams-purple"></div>
      </div>
    </div>
  );
}
