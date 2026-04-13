import Link from 'next/link';
import { Droplet } from 'lucide-react';

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-400 rounded-lg flex items-center justify-center shadow-md group-hover:shadow-lg transition-all">
              <Droplet className="w-6 h-6 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-gray-900">FloodScore</h1>
              <p className="text-xs text-gray-500">Financial Transparency</p>
            </div>
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              href="/"
              className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
            >
              Home
            </Link>
            <Link
              href="/analyze"
              className="text-gray-700 hover:text-blue-600 font-medium transition-colors"
            >
              Analyze
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
