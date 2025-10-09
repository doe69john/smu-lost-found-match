import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, Search, Plus, TrendingUp } from 'lucide-react';
import { Header } from '@/components/Header';

const Dashboard = () => {
  const [stats, setStats] = useState({
    lostItems: 0,
    foundItems: 0,
    myLostItems: 0,
    myFoundItems: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const [lostCount, foundCount, myLostCount, myFoundCount] = await Promise.all([
        supabase.from('lost_items').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('found_items').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('lost_items').select('*', { count: 'exact', head: true }).eq('user_id', user?.id || ''),
        supabase.from('found_items').select('*', { count: 'exact', head: true }).eq('user_id', user?.id || ''),
      ]);

      setStats({
        lostItems: lostCount.count || 0,
        foundItems: foundCount.count || 0,
        myLostItems: myLostCount.count || 0,
        myFoundItems: myFoundCount.count || 0,
      });
    };

    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-4 md:py-8 px-4">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Welcome to SMU Lost & Found. Report or search for lost items.
          </p>
        </div>

        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6 md:mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Lost Items</CardTitle>
              <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold">{stats.lostItems}</div>
              <p className="text-xs text-muted-foreground">Total active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Found Items</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold">{stats.foundItems}</div>
              <p className="text-xs text-muted-foreground">Total active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">My Lost</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold">{stats.myLostItems}</div>
              <p className="text-xs text-muted-foreground">Your reports</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">My Found</CardTitle>
              <Plus className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold">{stats.myFoundItems}</div>
              <p className="text-xs text-muted-foreground">Your finds</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Report Lost Item</CardTitle>
              <CardDescription>
                Lost something on campus? Let others know to help you find it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link to="/report-lost">
                  <Plus className="mr-2 h-4 w-4" />
                  Report Lost Item
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Report Found Item</CardTitle>
              <CardDescription>
                Found something? Help reunite it with its owner.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link to="/report-found">
                  <Package className="mr-2 h-4 w-4" />
                  Report Found Item
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">View Your Matches</CardTitle>
              <CardDescription className="text-sm">
                See potential matches for items you've reported as found.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link to="/browse-lost">
                  <Search className="mr-2 h-4 w-4" />
                  View Lost Item Matches
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">View Your Matches</CardTitle>
              <CardDescription className="text-sm">
                See potential matches for items you've reported as lost.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link to="/browse-found">
                  <Package className="mr-2 h-4 w-4" />
                  View Found Item Matches
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;