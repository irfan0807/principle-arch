import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { Store, Clock, DollarSign, TrendingUp, Check, X, Truck, Utensils, LogOut, Home } from "lucide-react";
import type { Restaurant, Order } from "@shared/schema";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { selectUser, signOutUser } from "@/store/slices/authSlice";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  preparing: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  ready_for_pickup: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  out_for_delivery: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  delivered: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function RestaurantDashboard() {
  const { toast } = useToast();
  const user = useAppSelector(selectUser);
  const dispatch = useAppDispatch();

  const { data: restaurants, isLoading: restaurantsLoading } = useQuery<Restaurant[]>({
    queryKey: ["/api/my-restaurants"],
  });

  const { data: orders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/orders/${orderId}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Order updated" });
    },
    onError: (error: any) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const assignDeliveryMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await apiRequest("POST", `/api/orders/${orderId}/assign-delivery`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Delivery partner assigned" });
    },
    onError: (error: any) => {
      toast({ title: "Assignment failed", description: error.message, variant: "destructive" });
    },
  });

  const pendingOrders = orders?.filter((o) => ["pending", "confirmed", "preparing", "ready_for_pickup"].includes(o.status)) || [];
  const completedOrders = orders?.filter((o) => ["delivered", "cancelled"].includes(o.status)) || [];
  const todayOrders = orders?.filter((o) => {
    if (!o.createdAt) return false;
    const today = new Date();
    const orderDate = new Date(o.createdAt);
    return orderDate.toDateString() === today.toDateString();
  }) || [];

  const todayRevenue = todayOrders.reduce((sum, o) => o.status !== "cancelled" ? sum + parseFloat(o.total) : sum, 0);

  if (restaurantsLoading || ordersLoading) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
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
            <Badge variant="secondary">Restaurant Owner</Badge>
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
        <h1 className="text-2xl font-bold mb-6">Restaurant Dashboard</h1>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Store className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Restaurants</p>
                  <p className="text-2xl font-bold">{restaurants?.length || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-orange-500/10">
                  <Clock className="h-6 w-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending Orders</p>
                  <p className="text-2xl font-bold">{pendingOrders.length}</p>
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
                  <p className="text-sm text-muted-foreground">Today's Revenue</p>
                  <p className="text-2xl font-bold">${todayRevenue.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <TrendingUp className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Today's Orders</p>
                  <p className="text-2xl font-bold">{todayOrders.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pending">
          <TabsList className="mb-4">
            <TabsTrigger value="pending" data-testid="tab-pending">
              Pending ({pendingOrders.length})
            </TabsTrigger>
            <TabsTrigger value="completed" data-testid="tab-completed">
              Completed ({completedOrders.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            {pendingOrders.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">No pending orders</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingOrders.map((order) => (
                      <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                        <TableCell className="font-medium">#{order.id.slice(0, 8)}</TableCell>
                        <TableCell>
                          {order.createdAt && format(new Date(order.createdAt), "h:mm a")}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[order.status]}>
                            {order.status.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>${parseFloat(order.total).toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {order.status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => updateStatusMutation.mutate({ orderId: order.id, status: "confirmed" })}
                                  disabled={updateStatusMutation.isPending}
                                  data-testid={`button-confirm-${order.id}`}
                                >
                                  <Check className="h-3 w-3 mr-1" />
                                  Accept
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => updateStatusMutation.mutate({ orderId: order.id, status: "cancelled" })}
                                  disabled={updateStatusMutation.isPending}
                                  data-testid={`button-reject-${order.id}`}
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Reject
                                </Button>
                              </>
                            )}
                            {order.status === "confirmed" && (
                              <Button
                                size="sm"
                                onClick={() => updateStatusMutation.mutate({ orderId: order.id, status: "preparing" })}
                                disabled={updateStatusMutation.isPending}
                              >
                                Start Preparing
                              </Button>
                            )}
                            {order.status === "preparing" && (
                              <Button
                                size="sm"
                                onClick={() => updateStatusMutation.mutate({ orderId: order.id, status: "ready_for_pickup" })}
                                disabled={updateStatusMutation.isPending}
                              >
                                Ready for Pickup
                              </Button>
                            )}
                            {order.status === "ready_for_pickup" && !order.deliveryPartnerId && (
                              <Button
                                size="sm"
                                onClick={() => assignDeliveryMutation.mutate(order.id)}
                                disabled={assignDeliveryMutation.isPending}
                              >
                                <Truck className="h-3 w-3 mr-1" />
                                Assign Delivery
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="completed">
            {completedOrders.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">No completed orders</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">#{order.id.slice(0, 8)}</TableCell>
                        <TableCell>
                          {order.createdAt && format(new Date(order.createdAt), "PP")}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[order.status]}>
                            {order.status.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>${parseFloat(order.total).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
