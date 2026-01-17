import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { selectCartItems, selectRestaurantId, selectRestaurantName, selectCartTotal, updateQuantity, removeItem, clearCart } from "@/store/slices/cartSlice";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Minus, Plus, Trash2, ArrowLeft, Tag, Utensils } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const dispatch = useAppDispatch();
  const items = useAppSelector(selectCartItems);
  const restaurantId = useAppSelector(selectRestaurantId);
  const restaurantName = useAppSelector(selectRestaurantName);
  const subtotal = useAppSelector(selectCartTotal);
  
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const deliveryFee = 2.99;
  const discount = appliedCoupon?.discount || 0;
  const total = subtotal + deliveryFee - discount;

  const validateCouponMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest("POST", "/api/coupons/validate", { code, subtotal });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.valid) {
        setAppliedCoupon({ code: couponCode, discount: data.discount });
        toast({ title: "Coupon applied!", description: `You saved $${data.discount.toFixed(2)}` });
      }
    },
    onError: (error: any) => {
      toast({ title: "Invalid coupon", description: error.message, variant: "destructive" });
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const orderData = {
        restaurantId,
        items: items.map((i) => ({
          menuItemId: i.menuItem.id,
          quantity: i.quantity,
          specialInstructions: i.specialInstructions,
        })),
        deliveryAddress,
        specialInstructions,
        couponCode: appliedCoupon?.code,
        idempotencyKey: `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };
      const res = await apiRequest("POST", "/api/orders", orderData);
      return res.json();
    },
    onSuccess: (order) => {
      dispatch(clearCart());
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({ title: "Order placed!", description: "Your order has been submitted successfully." });
      setLocation(`/orders/${order.id}`);
    },
    onError: (error: any) => {
      toast({ title: "Order failed", description: error.message, variant: "destructive" });
    },
  });

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
          <div className="container mx-auto flex h-16 items-center justify-between px-4">
            <Link href="/home" className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <Utensils className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">FoodDash</span>
            </Link>
            <ThemeToggle />
          </div>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <p className="text-muted-foreground mb-4">Your cart is empty</p>
          <Button onClick={() => setLocation("/home")}>Browse Restaurants</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/home" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Utensils className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">FoodDash</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <Button variant="ghost" className="mb-4" onClick={() => window.history.back()} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <h1 className="text-2xl font-bold mb-6">Checkout</h1>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Order from {restaurantName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item) => (
                <div key={item.menuItem.id} className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-medium">{item.menuItem.name}</p>
                    <p className="text-sm text-muted-foreground">
                      ${parseFloat(item.menuItem.price).toFixed(2)} each
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={() => dispatch(updateQuantity({ menuItemId: item.menuItem.id, quantity: item.quantity - 1 }))}
                      data-testid={`button-decrease-${item.menuItem.id}`}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      onClick={() => dispatch(updateQuantity({ menuItemId: item.menuItem.id, quantity: item.quantity + 1 }))}
                      data-testid={`button-increase-${item.menuItem.id}`}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => dispatch(removeItem(item.menuItem.id))}
                      data-testid={`button-remove-${item.menuItem.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="font-medium w-20 text-right">
                    ${(parseFloat(item.menuItem.price) * item.quantity).toFixed(2)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Delivery Address</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Enter your full delivery address..."
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                className="min-h-[100px]"
                data-testid="input-address"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Special Instructions</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Any special requests for the restaurant..."
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                data-testid="input-instructions"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Have a coupon?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Enter coupon code"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    className="pl-10"
                    disabled={!!appliedCoupon}
                    data-testid="input-coupon"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => validateCouponMutation.mutate(couponCode)}
                  disabled={!couponCode || !!appliedCoupon || validateCouponMutation.isPending}
                  data-testid="button-apply-coupon"
                >
                  Apply
                </Button>
              </div>
              {appliedCoupon && (
                <p className="text-sm text-green-600 mt-2">
                  Coupon {appliedCoupon.code} applied - You save ${appliedCoupon.discount.toFixed(2)}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery Fee</span>
                <span>${deliveryFee.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-${discount.toFixed(2)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-semibold text-lg">
                <span>Total</span>
                <span data-testid="text-total">${total.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          <Button
            className="w-full"
            size="lg"
            onClick={() => createOrderMutation.mutate()}
            disabled={!deliveryAddress || createOrderMutation.isPending}
            data-testid="button-place-order"
          >
            {createOrderMutation.isPending ? "Placing Order..." : `Place Order - $${total.toFixed(2)}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
