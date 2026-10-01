import { AppRoutes } from './routes/AppRoutes';
import { AccountStateProvider } from './context/AccountStateContext';
import { UserAvatarProvider } from './context/UserAvatarContext';

export default function App() {
  return (
    <AccountStateProvider>
      <UserAvatarProvider>
        <AppRoutes />
      </UserAvatarProvider>
    </AccountStateProvider>
  );
}
