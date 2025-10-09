import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Search, Plus, LogOut, User } from 'lucide-react';

export const Header = () => {
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 md:h-16 items-center justify-between px-4">
        <div className="flex items-center gap-3 md:gap-6">
          <Link to="/dashboard" className="flex items-center space-x-2">
            <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-md bg-primary">
              <span className="text-base md:text-xl font-bold text-primary-foreground">SMU</span>
            </div>
            <span className="hidden text-sm md:text-base font-bold sm:inline-block">Lost & Found</span>
          </Link>
          
          {user && (
            <nav className="hidden md:flex gap-4 lg:gap-6">
              <Link to="/browse-lost" className="text-sm font-medium transition-colors hover:text-primary">
                Matches
              </Link>
              <Link to="/browse-found" className="text-sm font-medium transition-colors hover:text-primary">
                Matches
              </Link>
            </nav>
          )}
        </div>

        {user && (
          <div className="flex items-center gap-1 md:gap-2">
            <Button variant="outline" size="sm" asChild className="hidden sm:flex">
              <Link to="/report-lost">
                <Plus className="mr-1 md:mr-2 h-4 w-4" />
                <span className="text-xs md:text-sm">Lost</span>
              </Link>
            </Button>
            <Button variant="default" size="sm" asChild className="hidden sm:flex">
              <Link to="/report-found">
                <Plus className="mr-1 md:mr-2 h-4 w-4" />
                <span className="text-xs md:text-sm">Found</span>
              </Link>
            </Button>
            <Button variant="outline" size="icon" asChild className="sm:hidden h-9 w-9">
              <Link to="/report-lost">
                <Plus className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="default" size="icon" asChild className="sm:hidden h-9 w-9">
              <Link to="/report-found">
                <Plus className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} className="h-9 w-9 md:h-10 md:w-10">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
};