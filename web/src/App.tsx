import { AppRoutes } from './routes/AppRoutes';
import { UserAvatarProvider } from './context/UserAvatarContext';

export default function App() {
  return (
    <UserAvatarProvider>
      <AppRoutes />
    </UserAvatarProvider>
  );
}
