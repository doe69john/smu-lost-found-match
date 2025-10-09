import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Search, Plus, LogOut, User } from 'lucide-react';

export const Header = () => {
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/dashboard" className="flex items-center space-x-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
              <span className="text-xl font-bold text-primary-foreground">SMU</span>
            </div>
            <span className="hidden font-bold sm:inline-block">Lost & Found</span>
          </Link>
          
          {user && (
            <nav className="hidden md:flex gap-6">
              <Link to="/browse-lost" className="text-sm font-medium transition-colors hover:text-primary">
                Lost Items
              </Link>
              <Link to="/browse-found" className="text-sm font-medium transition-colors hover:text-primary">
                Found Items
              </Link>
            </nav>
          )}
        </div>

        {user && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/report-lost">
                <Plus className="mr-2 h-4 w-4" />
                Report Lost
              </Link>
            </Button>
            <Button variant="default" size="sm" asChild>
              <Link to="/report-found">
                <Plus className="mr-2 h-4 w-4" />
                Report Found
              </Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
};