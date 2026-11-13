import { IdentityProvider } from "./shared/auth/identity-provider";
import AppRoutes from "./AppRoutes";

export default function App() {
  return (
    <IdentityProvider>
      <AppRoutes />
    </IdentityProvider>
  );
}
