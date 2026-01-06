import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { ArrowLeft, MapPin, Phone, CheckCircle2, Circle, Clock } from "lucide-react";
import type { Order, OrderItem, OrderEvent, Restaurant } from "@shared/schema";
import { useEffect, useRef, useState } from "react";

const statusSteps = [
  { key: "pending", label: "Order Placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "preparing", label: "Preparing" },
  { key: "ready_for_pickup", label: "Ready for Pickup" },
  { key: "out_for_delivery", label: "Out for Delivery" },
  { key: "delivered", label: "Delivered" },
];

type OrderWithDetails = Order & {
  items: (OrderItem & { menuItem?: { name: string } })[];
  events: OrderEvent[];
  restaurant: Restaurant;
};

export default function OrderTracking() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [liveLocation, setLiveLocation] = useState<{ lat: number; lng: number } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const { data: order, isLoading, refetch } = useQuery<OrderWithDetails>({
    queryKey: ["/api/orders", params.id],
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (!order) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws?userId=${order.customerId}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "order_update" && data.data.orderId === order.id) {
        refetch();
      }
      if (data.type === "location_update" && data.data.orderId === order.id) {
        setLiveLocation({ lat: data.data.latitude, lng: data.data.longitude });
      }
    };

    return () => {
      ws.close();
    };
  }, [order?.id, order?.customerId, refetch]);

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-64 mb-4" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Order not found</p>
      </div>
    );
  }

  const currentStepIndex = statusSteps.findIndex((s) => s.key === order.status);
  const isCancelled = order.status === "cancelled";

  return (
    <div className="flex-1 overflow-auto">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <Button variant="ghost" className="mb-4" onClick={() => setLocation("/orders")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Orders
        </Button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Order #{order.id.slice(0, 8)}</h1>
            <p className="text-sm text-muted-foreground">
              Placed on {order.createdAt && format(new Date(order.createdAt), "PPpp")}
            </p>
          </div>
          {isCancelled && (
            <Badge variant="destructive">Cancelled</Badge>
          )}
        </div>

        {!isCancelled && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Order Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {statusSteps.map((step, index) => {
                  const isCompleted = index < currentStepIndex;
                  const isCurrent = index === currentStepIndex;
                  const event = order.events?.find((e) => e.eventType === `status_${step.key}` || (step.key === "pending" && e.eventType === "order_created"));

                  return (
                    <div key={step.key} className="flex items-start gap-4">
                      <div className="flex flex-col items-center">
                        {isCompleted ? (
                          <CheckCircle2 className="h-6 w-6 text-green-600" />
                        ) : isCurrent ? (
                          <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center animate-pulse">
                            <Circle className="h-3 w-3 text-primary-foreground fill-current" />
                          </div>
                        ) : (
                          <Circle className="h-6 w-6 text-muted-foreground" />
                        )}
                        {index < statusSteps.length - 1 && (
                          <div className={`w-0.5 h-8 ${isCompleted ? "bg-green-600" : "bg-muted"}`} />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <p className={`font-medium ${isCurrent ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground"}`}>
                          {step.label}
                        </p>
                        {event && (
                          <p className="text-xs text-muted-foreground">
                            {event.createdAt && format(new Date(event.createdAt), "h:mm a")}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {order.status === "out_for_delivery" && liveLocation && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Live Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="h-8 w-8 mx-auto mb-2 text-primary animate-bounce" />
                  <p className="text-sm text-muted-foreground">
                    Delivery partner location: {liveLocation.lat.toFixed(4)}, {liveLocation.lng.toFixed(4)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Restaurant</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{order.restaurant?.name}</p>
                <p className="text-sm text-muted-foreground">{order.restaurant?.address}</p>
              </div>
              {order.restaurant?.phone && (
                <Button variant="outline" size="icon" asChild>
                  <a href={`tel:${order.restaurant.phone}`}>
                    <Phone className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Delivery Address</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <p className="text-sm">{order.deliveryAddress}</p>
            </div>
            {order.specialInstructions && (
              <p className="text-sm text-muted-foreground mt-2">
                Note: {order.specialInstructions}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {order.items?.map((item) => (
              <div key={item.id} className="flex justify-between">
                <span>
                  {item.quantity}x {item.menuItemId.slice(0, 8)}...
                </span>
                <span>${parseFloat(item.price).toFixed(2)}</span>
              </div>
            ))}
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>${parseFloat(order.subtotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Delivery Fee</span>
              <span>${parseFloat(order.deliveryFee || "0").toFixed(2)}</span>
            </div>
            {parseFloat(order.discount || "0") > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount</span>
                <span>-${parseFloat(order.discount || "0").toFixed(2)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>${parseFloat(order.total).toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
