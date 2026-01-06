import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Star, Clock, MapPin, Plus, Minus, ArrowLeft, ShoppingCart, Leaf, Flame } from "lucide-react";
import type { Restaurant as RestaurantType, MenuItem, MenuCategory } from "@shared/schema";
import { useCart } from "@/lib/cart";
import { useState } from "react";

export default function Restaurant() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { items, addItem, removeItem, updateQuantity, getItemCount, getSubtotal, restaurantId } = useCart();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data: restaurant, isLoading: restaurantLoading } = useQuery<RestaurantType>({
    queryKey: ["/api/restaurants", params.id],
  });

  const { data: categories } = useQuery<MenuCategory[]>({
    queryKey: ["/api/restaurants", params.id, "categories"],
    enabled: !!params.id,
  });

  const { data: menuItems, isLoading: menuLoading } = useQuery<MenuItem[]>({
    queryKey: ["/api/restaurants", params.id, "menu"],
    enabled: !!params.id,
  });

  const getItemQuantity = (menuItemId: string) => {
    const item = items.find((i) => i.menuItem.id === menuItemId);
    return item?.quantity || 0;
  };

  const filteredItems = selectedCategory
    ? menuItems?.filter((item) => item.categoryId === selectedCategory)
    : menuItems;

  const groupedItems = filteredItems?.reduce((acc, item) => {
    const categoryId = item.categoryId || "uncategorized";
    if (!acc[categoryId]) acc[categoryId] = [];
    acc[categoryId].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  if (restaurantLoading) {
    return (
      <div className="flex-1 overflow-auto p-4">
        <Skeleton className="h-48 w-full mb-4" />
        <Skeleton className="h-8 w-1/2 mb-2" />
        <Skeleton className="h-4 w-1/3 mb-4" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Restaurant not found</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto">
        <div className="relative">
          <div className="aspect-[3/1] bg-muted">
            {restaurant.imageUrl ? (
              <img src={restaurant.imageUrl} alt={restaurant.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                <span className="text-6xl font-bold text-primary/30">{restaurant.name.charAt(0)}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 left-4 bg-background/80 backdrop-blur"
            onClick={() => setLocation("/home")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>

        <div className="container mx-auto px-4 -mt-16 relative z-10">
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold mb-1" data-testid="text-restaurant-name">{restaurant.name}</h1>
                  <p className="text-muted-foreground mb-2">{restaurant.cuisine}</p>
                  {restaurant.description && (
                    <p className="text-sm text-muted-foreground mb-4">{restaurant.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <Badge variant="secondary">
                      <Star className="h-3 w-3 mr-1 fill-current" />
                      {parseFloat(restaurant.rating || "0").toFixed(1)} ({restaurant.totalRatings} reviews)
                    </Badge>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {restaurant.deliveryTime} min
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {restaurant.address}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Delivery Fee</p>
                  <p className="font-semibold">${parseFloat(restaurant.deliveryFee || "0").toFixed(2)}</p>
                  {parseFloat(restaurant.minimumOrder || "0") > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Min. order: ${parseFloat(restaurant.minimumOrder || "0").toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {categories && categories.length > 0 && (
            <ScrollArea className="mb-4">
              <div className="flex gap-2 pb-2">
                <Button
                  variant={selectedCategory === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(null)}
                  data-testid="filter-category-all"
                >
                  All
                </Button>
                {categories.map((cat) => (
                  <Button
                    key={cat.id}
                    variant={selectedCategory === cat.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(cat.id)}
                    data-testid={`filter-category-${cat.id}`}
                  >
                    {cat.name}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          )}

          {menuLoading ? (
            <div className="grid gap-4 md:grid-cols-2 pb-24">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : (
            <div className="pb-24">
              {Object.entries(groupedItems || {}).map(([categoryId, items]) => {
                const category = categories?.find((c) => c.id === categoryId);
                return (
                  <div key={categoryId} className="mb-8">
                    {category && (
                      <h2 className="text-xl font-semibold mb-4">{category.name}</h2>
                    )}
                    <div className="grid gap-4 md:grid-cols-2">
                      {items.map((item) => {
                        const qty = getItemQuantity(item.id);
                        return (
                          <Card key={item.id} className="overflow-hidden" data-testid={`card-menu-item-${item.id}`}>
                            <CardContent className="p-0">
                              <div className="flex">
                                <div className="flex-1 p-4">
                                  <div className="flex items-start gap-2 mb-1">
                                    <h3 className="font-medium">{item.name}</h3>
                                    {item.isVegetarian && (
                                      <Leaf className="h-4 w-4 text-green-600 shrink-0" />
                                    )}
                                    {(item.spiceLevel ?? 0) > 2 && (
                                      <Flame className="h-4 w-4 text-red-500 shrink-0" />
                                    )}
                                  </div>
                                  {item.description && (
                                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                      {item.description}
                                    </p>
                                  )}
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold">${parseFloat(item.price).toFixed(2)}</span>
                                    {item.isPopular && (
                                      <Badge variant="secondary" className="text-xs">Popular</Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="w-28 h-28 bg-muted shrink-0 relative">
                                  {item.imageUrl ? (
                                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                                      <span className="text-2xl font-bold text-primary/20">{item.name.charAt(0)}</span>
                                    </div>
                                  )}
                                  <div className="absolute bottom-2 right-2">
                                    {qty === 0 ? (
                                      <Button
                                        size="sm"
                                        onClick={() => addItem(item, restaurant.id, restaurant.name)}
                                        disabled={!item.isAvailable}
                                        data-testid={`button-add-${item.id}`}
                                      >
                                        <Plus className="h-4 w-4" />
                                      </Button>
                                    ) : (
                                      <div className="flex items-center gap-1 bg-background rounded-md shadow">
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-8 w-8"
                                          onClick={() => updateQuantity(item.id, qty - 1)}
                                          data-testid={`button-decrease-${item.id}`}
                                        >
                                          <Minus className="h-3 w-3" />
                                        </Button>
                                        <span className="w-6 text-center text-sm font-medium">{qty}</span>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-8 w-8"
                                          onClick={() => addItem(item, restaurant.id, restaurant.name)}
                                          data-testid={`button-increase-${item.id}`}
                                        >
                                          <Plus className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {getItemCount() > 0 && restaurantId === restaurant.id && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 md:left-[--sidebar-width]">
          <div className="container mx-auto">
            <Button
              className="w-full"
              size="lg"
              onClick={() => setLocation("/checkout")}
              data-testid="button-view-cart"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              View Cart ({getItemCount()} items) - ${getSubtotal().toFixed(2)}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
