import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { MapPin, DollarSign, Package, Star, Navigation, Phone, Utensils, LogOut, Home } from "lucide-react";
import type { DeliveryPartner, Order } from "@shared/schema";
import { useState, useEffect } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { selectUser, signOutUser } from "@/store/slices/authSlice";

export default function DeliveryDashboard() {
  const { toast } = useToast();
  const user = useAppSelector(selectUser);
  const dispatch = useAppDispatch();
  const [isOnline, setIsOnline] = useState(false);

  const { data: partner, isLoading: partnerLoading } = useQuery<DeliveryPartner>({
    queryKey: ["/api/delivery-partner"],
  });

  const { data: orders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest("PATCH", "/api/delivery-partner", { status });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/delivery-partner"] });
      toast({ title: `You are now ${data.status}` });
    },
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/orders/${orderId}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Order status updated" });
    },
  });

  const updateLocationMutation = useMutation({
    mutationFn: async (coords: { latitude: string; longitude: string }) => {
      const res = await apiRequest("POST", "/api/delivery-partner/location", coords);
      return res.json();
    },
  });

  useEffect(() => {
    if (!partner) return;
    setIsOnline(partner.status === "available" || partner.status === "busy");
  }, [partner]);

  useEffect(() => {
    if (!isOnline || !partner) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        updateLocationMutation.mutate({
          latitude: position.coords.latitude.toString(),
          longitude: position.coords.longitude.toString(),
        });
      },
      (error) => console.error("Geolocation error:", error),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isOnline, partner]);

  const handleOnlineToggle = (checked: boolean) => {
    setIsOnline(checked);
    updateStatusMutation.mutate(checked ? "available" : "offline");
  };

  const activeDelivery = orders?.find((o) => o.status === "out_for_delivery");
  const assignedOrders = orders?.filter((o) => o.status === "ready_for_pickup") || [];
  const completedDeliveries = orders?.filter((o) => o.status === "delivered") || [];

  if (partnerLoading || ordersLoading) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground mb-4">
              You are not registered as a delivery partner.
            </p>
            <p className="text-sm text-muted-foreground">
              Please contact support to register.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link href="/home" className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <Utensils className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">FoodDash</span>
            </Link>
            <Badge variant="secondary">Delivery Partner</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/home">
              <Button variant="ghost" size="sm">
                <Home className="h-4 w-4 mr-2" />
                Home
              </Button>
            </Link>
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => dispatch(signOutUser())}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Delivery Dashboard</h1>
          <div className="flex items-center gap-2">
            <Switch
              id="online-mode"
              checked={isOnline}
              onCheckedChange={handleOnlineToggle}
              disabled={updateStatusMutation.isPending}
              data-testid="switch-online"
            />
            <Label htmlFor="online-mode" className="cursor-pointer">
              {isOnline ? (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Online</Badge>
              ) : (
                <Badge variant="secondary">Offline</Badge>
              )}
            </Label>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Package className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Deliveries</p>
                  <p className="text-2xl font-bold">{partner.totalDeliveries}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-500/10">
                  <DollarSign className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Earnings</p>
                  <p className="text-2xl font-bold">${parseFloat(partner.totalEarnings || "0").toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-yellow-500/10">
                  <Star className="h-6 w-6 text-yellow-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Rating</p>
                  <p className="text-2xl font-bold">{parseFloat(partner.rating || "5.0").toFixed(1)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <Navigation className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Vehicle</p>
                  <p className="text-2xl font-bold capitalize">{partner.vehicleType}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {activeDelivery && (
          <Card className="mb-6 border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Navigation className="h-5 w-5 text-primary animate-pulse" />
                Active Delivery
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <p className="font-medium">Order #{activeDelivery.id.slice(0, 8)}</p>
                  <div className="flex items-start gap-2 mt-2">
                    <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <p className="text-sm text-muted-foreground">{activeDelivery.deliveryAddress}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" asChild>
                    <a href={`tel:customer`}>
                      <Phone className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    onClick={() => updateOrderStatusMutation.mutate({ orderId: activeDelivery.id, status: "delivered" })}
                    disabled={updateOrderStatusMutation.isPending}
                    data-testid="button-complete-delivery"
                  >
                    Mark Delivered
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {assignedOrders.length > 0 && !activeDelivery && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Available Pickups</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {assignedOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 rounded-lg border"
                  data-testid={`card-pickup-${order.id}`}
                >
                  <div>
                    <p className="font-medium">Order #{order.id.slice(0, 8)}</p>
                    <p className="text-sm text-muted-foreground">
                      {order.createdAt && format(new Date(order.createdAt), "h:mm a")}
                    </p>
                  </div>
                  <Button
                    onClick={() => updateOrderStatusMutation.mutate({ orderId: order.id, status: "out_for_delivery" })}
                    disabled={updateOrderStatusMutation.isPending}
                  >
                    Start Delivery
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {!isOnline && !activeDelivery && (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                Go online to start receiving delivery requests
              </p>
            </CardContent>
          </Card>
        )}

        {isOnline && assignedOrders.length === 0 && !activeDelivery && (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                No deliveries available at the moment. Please wait for new orders.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
