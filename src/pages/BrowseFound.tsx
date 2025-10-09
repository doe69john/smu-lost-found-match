import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Calendar, MapPin, Lock } from 'lucide-react';

interface Match {
  id: string;
  confidence_score: number;
  status: string;
  found_items: {
    category: string;
    brand: string | null;
    model: string | null;
    color: string | null;
    description: string;
    location_found: string;
    date_found: string;
    image_url: string | null;
  };
}

const BrowseFound = () => {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchMatches();
    }
  }, [user]);

  const fetchMatches = async () => {
    const { data: lostItems } = await supabase
      .from('lost_items')
      .select('id')
      .eq('user_id', user?.id);

    if (lostItems && lostItems.length > 0) {
      const lostItemIds = lostItems.map(item => item.id);
      
      const { data, error } = await supabase
        .from('matches')
        .select(`
          id,
          confidence_score,
          status,
          found_items (
            category,
            brand,
            model,
            color,
            description,
            location_found,
            date_found,
            image_url
          )
        `)
        .in('lost_item_id', lostItemIds)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setMatches(data);
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-4 md:py-8 px-4">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">Your Matches - Found Items</h1>
          <p className="text-sm md:text-base text-muted-foreground">Potential matches for items you lost</p>
        </div>

        <div className="mb-6 p-4 bg-muted/50 rounded-lg flex items-start gap-3">
          <Lock className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            For privacy and security, you can only view items that match what you've reported. 
            All information is kept confidential until a match is confirmed.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : matches.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="mb-2">No matches found yet.</p>
            <p className="text-sm">When someone reports finding an item that matches yours, it will appear here.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {matches.map((match) => (
              <Card key={match.id} className="overflow-hidden">
                {match.found_items.image_url && (
                  <div className="aspect-video w-full overflow-hidden bg-muted">
                    <img 
                      src={match.found_items.image_url} 
                      alt={match.found_items.description}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <CardTitle className="line-clamp-1 text-lg">{match.found_items.brand || match.found_items.category}</CardTitle>
                    <Badge className="flex-shrink-0">{match.found_items.category}</Badge>
                  </div>
                  <CardDescription className="line-clamp-2 text-sm">
                    {match.found_items.description}
                  </CardDescription>
                  <Badge variant="secondary" className="w-fit mt-2">
                    {Math.round(match.confidence_score)}% Match
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-2">
                  {match.found_items.model && (
                    <p className="text-sm">
                      <span className="font-medium">Model:</span> {match.found_items.model}
                    </p>
                  )}
                  {match.found_items.color && (
                    <p className="text-sm">
                      <span className="font-medium">Color:</span> {match.found_items.color}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{match.found_items.location_found}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 flex-shrink-0" />
                    {format(new Date(match.found_items.date_found), 'MMM d, yyyy')}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default BrowseFound;