import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthInitializer } from "@/components/AuthInitializer";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Home from "@/pages/Home";
import Restaurant from "@/pages/Restaurant";
import Checkout from "@/pages/Checkout";
import Orders from "@/pages/Orders";
import OrderTracking from "@/pages/OrderTracking";
import RestaurantDashboard from "@/pages/RestaurantDashboard";
import DeliveryDashboard from "@/pages/DeliveryDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import SignIn from "@/pages/SignIn";
import SignUp from "@/pages/SignUp";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/sign-in" component={SignIn} />
      <Route path="/sign-up" component={SignUp} />
      <Route path="/home" component={Home} />
      <Route path="/restaurant/:id" component={Restaurant} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/orders" component={Orders} />
      <Route path="/order/:id" component={OrderTracking} />
      <Route path="/restaurant-dashboard" component={RestaurantDashboard} />
      <Route path="/delivery-dashboard" component={DeliveryDashboard} />
      <Route path="/admin" component={AdminDashboard} />
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthInitializer />
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
