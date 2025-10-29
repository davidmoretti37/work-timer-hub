import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export function BirthdayPopup() {
  const [user, setUser] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [birthday, setBirthday] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const checkBirthday = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) return;

      setUser(session.user);

      // Check if user has already set their birthday
      const { data, error } = await supabase
        .from('profiles')
        .select('date_of_birth')
        .eq('id', session.user.id)
        .single();

      if (error) {
        console.error('Error checking birthday:', error);
        return;
      }

      // If no birthday is set, show the popup
      if (!data.date_of_birth) {
        setOpen(true);
      }
    };

    checkBirthday();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !birthday) return;

    setLoading(true);

    const { error } = await supabase
      .from('profiles')
      .update({ date_of_birth: birthday })
      .eq('id', user.id);

    if (error) {
      console.error('Error saving birthday:', error);
      toast({
        title: 'Error',
        description: 'Failed to save your birthday. Please try again.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Birthday saved!',
        description: 'Your birthday has been added to the calendar.',
      });
      setOpen(false);
    }

    setLoading(false);
  };

  const handleSkip = () => {
    // Set a far future date to indicate they skipped
    // This prevents the popup from showing again
    if (!user) return;

    supabase
      .from('profiles')
      .update({ date_of_birth: '9999-12-31' })
      .eq('id', user.id)
      .then(() => {
        setOpen(false);
      });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">Welcome! 🎉</DialogTitle>
          <DialogDescription className="text-base">
            Help us celebrate you! Add your birthday so the team can wish you a happy birthday.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="birthday">Your Birthday</Label>
              <Input
                id="birthday"
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                required
                max={new Date().toISOString().split('T')[0]}
              />
              <p className="text-xs text-muted-foreground">
                Don't worry, we'll only show the day and month on the calendar.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleSkip}
              disabled={loading}
            >
              Skip for now
            </Button>
            <Button type="submit" disabled={loading || !birthday}>
              {loading ? 'Saving...' : 'Save Birthday'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
