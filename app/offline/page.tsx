import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-md space-y-4 text-center">
      <h1 className="text-2xl font-semibold">You are offline</h1>
      <p className="text-muted-foreground">No network available. You can continue with cached pages and retry when connected.</p>
      <Button asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  );
}
