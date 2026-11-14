import { IdentityProvider } from "./features/identity/identity-provider";
import AppRoutes from "./AppRoutes";

export default function App() {
  return (
    <IdentityProvider>
      <AppRoutes />
    </IdentityProvider>
  );
}
