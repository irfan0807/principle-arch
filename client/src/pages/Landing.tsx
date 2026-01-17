import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MapPin, Clock, Star, ShieldCheck, Truck, Utensils, LogOut } from "lucide-react";
import { Link } from "wouter";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { selectUser, selectIsAuthenticated, signOutUser } from "@/store/slices/authSlice";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Landing() {
  const user = useAppSelector(selectUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const dispatch = useAppDispatch();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Utensils className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">FoodDash</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {!isAuthenticated ? (
              <Link href="/sign-in">
                <Button data-testid="button-login">Sign In</Button>
              </Link>
            ) : (
              <>
                <Link href="/home">
                  <Button variant="ghost">Browse</Button>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user?.profileImageUrl} alt={user?.firstName || "User"} />
                        <AvatarFallback>
                          {user?.firstName?.[0] || user?.email?.[0] || "U"}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => dispatch(signOutUser())}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
        <div className="container mx-auto px-4 py-20 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Delicious Food,{" "}
              <span className="text-primary">Delivered Fast</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground md:text-xl">
              Order from your favorite local restaurants and get fresh, hot meals 
              delivered right to your door in minutes. Track your order in real-time.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              {!isAuthenticated ? (
                <Link href="/sign-up">
                  <Button size="lg" className="min-w-[200px]" data-testid="button-get-started">
                    Get Started
                  </Button>
                </Link>
              ) : (
                <Link href="/home">
                  <Button size="lg" className="min-w-[200px]" data-testid="button-get-started">
                    Order Now
                  </Button>
                </Link>
              )}
              <Button size="lg" variant="outline" className="min-w-[200px]" data-testid="button-learn-more">
                Learn More
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t bg-card py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold">How It Works</h2>
            <p className="mt-4 text-muted-foreground">
              Getting your favorite food is just a few taps away
            </p>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <MapPin className="h-7 w-7 text-primary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">Choose Location</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Enter your delivery address to find nearby restaurants
                </p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <Utensils className="h-7 w-7 text-primary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">Browse & Order</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Explore menus, customize your order, and checkout securely
                </p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <Truck className="h-7 w-7 text-primary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">Fast Delivery</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Track your order in real-time as it arrives at your door
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold">Why Choose FoodDash?</h2>
            <p className="mt-4 text-muted-foreground">
              We're committed to bringing you the best food delivery experience
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10">
                <Clock className="h-5 w-5 text-success" />
              </div>
              <div>
                <h3 className="font-semibold">Fast Delivery</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Average delivery time of 30 minutes or less
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Star className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Top Restaurants</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Partner with the best local restaurants
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-chart-3/10">
                <ShieldCheck className="h-5 w-5 text-chart-3" />
              </div>
              <div>
                <h3 className="font-semibold">Secure Payments</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Safe and secure payment processing
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-chart-2/10">
                <MapPin className="h-5 w-5 text-chart-2" />
              </div>
              <div>
                <h3 className="font-semibold">Live Tracking</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Real-time order tracking from kitchen to door
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t bg-card py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold">Ready to Order?</h2>
          <p className="mt-2 text-muted-foreground">
            Join thousands of happy customers enjoying delicious food every day
          </p>
          <a href="/api/login">
            <Button size="lg" className="mt-6" data-testid="button-order-now">
              Order Now
            </Button>
          </a>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="container mx-auto flex flex-col items-center gap-4 px-4 text-center text-sm text-muted-foreground md:flex-row md:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Utensils className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">FoodDash</span>
          </div>
          <p>Food Delivery Platform Demo</p>
        </div>
      </footer>
    </div>
  );
}
