import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import type { Order } from "@shared/schema";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  preparing: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  ready_for_pickup: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  out_for_delivery: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  delivered: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function Orders() {
  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Your Orders</h1>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">Your Orders</h1>

        {orders?.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">You haven't placed any orders yet.</p>
            <Link href="/">
              <a className="text-primary hover:underline">Browse restaurants</a>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders?.map((order) => (
              <Link key={order.id} href={`/orders/${order.id}`}>
                <Card className="hover-elevate cursor-pointer" data-testid={`card-order-${order.id}`}>
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">Order #{order.id.slice(0, 8)}</h3>
                          <Badge className={statusColors[order.status]}>
                            {order.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {order.createdAt && format(new Date(order.createdAt), "PPpp")}
                        </p>
                        <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                          {order.deliveryAddress}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-lg">${parseFloat(order.total).toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground">
                          {order.paymentStatus === "completed" ? "Paid" : order.paymentStatus}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
