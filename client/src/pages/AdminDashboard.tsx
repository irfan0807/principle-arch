import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Users, Store, Package, DollarSign, TrendingUp, Activity } from "lucide-react";
import type { Restaurant, Order } from "@shared/schema";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  preparing: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  ready_for_pickup: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  out_for_delivery: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  delivered: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function AdminDashboard() {
  const { data: restaurants, isLoading: restaurantsLoading } = useQuery<Restaurant[]>({
    queryKey: ["/api/restaurants"],
  });

  const { data: orders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const { data: healthData } = useQuery<{ status: string }>({
    queryKey: ["/api/health/ready"],
    refetchInterval: 30000,
  });

  const totalRevenue = orders?.reduce((sum, o) => o.status !== "cancelled" ? sum + parseFloat(o.total) : sum, 0) || 0;
  const todayOrders = orders?.filter((o) => {
    if (!o.createdAt) return false;
    const today = new Date();
    const orderDate = new Date(o.createdAt);
    return orderDate.toDateString() === today.toDateString();
  }) || [];
  const pendingOrders = orders?.filter((o) => ["pending", "confirmed", "preparing", "ready_for_pickup", "out_for_delivery"].includes(o.status)) || [];

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
    <div className="flex-1 overflow-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <Badge className={healthData?.status === "ready" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
            <Activity className="h-3 w-3 mr-1" />
            {healthData?.status === "ready" ? "System Healthy" : "System Issues"}
          </Badge>
        </div>

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
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <Package className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                  <p className="text-2xl font-bold">{orders?.length || 0}</p>
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
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">${totalRevenue.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-orange-500/10">
                  <TrendingUp className="h-6 w-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Today's Orders</p>
                  <p className="text-2xl font-bold">{todayOrders.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="orders">
          <TabsList className="mb-4">
            <TabsTrigger value="orders">Recent Orders</TabsTrigger>
            <TabsTrigger value="restaurants">Restaurants</TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>All Orders</CardTitle>
              </CardHeader>
              <CardContent>
                {orders?.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No orders yet</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Payment</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders?.slice(0, 20).map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">#{order.id.slice(0, 8)}</TableCell>
                          <TableCell>
                            {order.createdAt && format(new Date(order.createdAt), "PP p")}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[order.status]}>
                              {order.status.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>${parseFloat(order.total).toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant={order.paymentStatus === "completed" ? "default" : "secondary"}>
                              {order.paymentStatus}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="restaurants">
            <Card>
              <CardHeader>
                <CardTitle>All Restaurants</CardTitle>
              </CardHeader>
              <CardContent>
                {restaurants?.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No restaurants yet</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Cuisine</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {restaurants?.map((restaurant) => (
                        <TableRow key={restaurant.id}>
                          <TableCell className="font-medium">{restaurant.name}</TableCell>
                          <TableCell>{restaurant.cuisine}</TableCell>
                          <TableCell>{restaurant.city}</TableCell>
                          <TableCell>
                            {parseFloat(restaurant.rating || "0").toFixed(1)} ({restaurant.totalRatings})
                          </TableCell>
                          <TableCell>
                            <Badge variant={restaurant.isActive ? "default" : "secondary"}>
                              {restaurant.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
