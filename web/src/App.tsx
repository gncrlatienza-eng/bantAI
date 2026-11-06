import { AppRoutes } from './routes/AppRoutes';
import { ScrollToTop } from './components/common/ScrollToTop';
import { AccountStateProvider } from './context/AccountStateContext';
import { UserAvatarProvider } from './context/UserAvatarContext';

export default function App() {
  return (
    <AccountStateProvider>
      <UserAvatarProvider>
        <ScrollToTop />
        <AppRoutes />
      </UserAvatarProvider>
    </AccountStateProvider>
  );
}
