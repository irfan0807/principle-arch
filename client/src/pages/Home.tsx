import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Star, Clock, MapPin, Utensils, ShoppingCart, LogOut, Store, Bike, Shield } from "lucide-react";
import type { Restaurant } from "@shared/schema";
import { useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/components/AuthProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Home() {
  const { user, signOut } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: restaurants, isLoading } = useQuery<Restaurant[]>({
    queryKey: searchQuery ? ["/api/restaurants/search", { q: searchQuery }] : ["/api/restaurants"],
  });

  const cuisineFilters = ["All", "Italian", "Indian", "Chinese", "Mexican", "Japanese", "Thai", "American"];
  const [selectedCuisine, setSelectedCuisine] = useState("All");

  const filteredRestaurants = restaurants?.filter(r => 
    selectedCuisine === "All" || r.cuisine.toLowerCase().includes(selectedCuisine.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Utensils className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">FoodDash</span>
          </Link>
          
          <div className="flex items-center gap-2">
            <Link href="/orders">
              <Button variant="ghost" size="sm">My Orders</Button>
            </Link>
            <Link href="/checkout">
              <Button variant="ghost" size="icon">
                <ShoppingCart className="h-5 w-5" />
              </Button>
            </Link>
            <ThemeToggle />
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
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-muted-foreground">{user?.email || user?.phone || user?.id}</p>
                </div>
                <DropdownMenuSeparator />
                {(user?.role === "restaurant_owner" || user?.role === "admin") && (
                  <Link href="/restaurant-dashboard">
                    <DropdownMenuItem>
                      <Store className="mr-2 h-4 w-4" />
                      Restaurant Dashboard
                    </DropdownMenuItem>
                  </Link>
                )}
                {(user?.role === "delivery" || user?.role === "admin") && (
                  <Link href="/delivery-dashboard">
                    <DropdownMenuItem>
                      <Bike className="mr-2 h-4 w-4" />
                      Delivery Dashboard
                    </DropdownMenuItem>
                  </Link>
                )}
                {user?.role === "admin" && (
                  <Link href="/admin">
                    <DropdownMenuItem>
                      <Shield className="mr-2 h-4 w-4" />
                      Admin Dashboard
                    </DropdownMenuItem>
                  </Link>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Discover Restaurants</h1>
          <p className="text-muted-foreground">Order from your favorite local restaurants</p>
        </div>

        <div className="flex flex-col gap-4 mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search restaurants or cuisines..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search"
            />
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2">
            {cuisineFilters.map((cuisine) => (
              <Button
                key={cuisine}
                variant={selectedCuisine === cuisine ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCuisine(cuisine)}
                data-testid={`filter-cuisine-${cuisine.toLowerCase()}`}
              >
                {cuisine}
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <Skeleton className="h-48 w-full rounded-t-lg" />
                <CardContent className="p-4">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2 mb-4" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredRestaurants?.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No restaurants found. Try a different search.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredRestaurants?.map((restaurant) => (
              <Link key={restaurant.id} href={`/restaurant/${restaurant.id}`}>
                <Card className="overflow-hidden hover-elevate cursor-pointer" data-testid={`card-restaurant-${restaurant.id}`}>
                  <div className="aspect-video bg-muted relative">
                    {restaurant.imageUrl ? (
                      <img
                        src={restaurant.imageUrl}
                        alt={restaurant.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                        <span className="text-4xl font-bold text-primary/30">{restaurant.name.charAt(0)}</span>
                      </div>
                    )}
                    {!restaurant.isActive && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Badge variant="secondary">Currently Closed</Badge>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-lg line-clamp-1">{restaurant.name}</h3>
                      <Badge variant="secondary" className="shrink-0">
                        <Star className="h-3 w-3 mr-1 fill-current" />
                        {parseFloat(restaurant.rating || "0").toFixed(1)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{restaurant.cuisine}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {restaurant.deliveryTime} min
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {restaurant.city}
                      </span>
                    </div>
                    {parseFloat(restaurant.minimumOrder || "0") > 0 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Min. order: ${parseFloat(restaurant.minimumOrder || "0").toFixed(2)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
