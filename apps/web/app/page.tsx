import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">LAHANS Connect</h1>
        <p className="mt-2 text-muted-foreground">
          HRIS PT Lahan Mekar Niaga — Foundation S0, M8B Format &amp; Validasi, M1B Master Data
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/login">Masuk</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/master/employees">Master Karyawan</Link>
        </Button>
      </div>
    </main>
  );
}