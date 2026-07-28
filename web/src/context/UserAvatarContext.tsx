import React, { createContext, useContext, useState, useEffect } from 'react';

export interface AvatarState {
  type: 'preset' | 'initials' | 'image';
  presetIcon?: string;
  initials: string;
  gradient: string;
  imageUrl?: string;
}

interface UserAvatarContextType {
  adminAvatar: AvatarState;
  clientAvatar: AvatarState;
  setAdminAvatar: (avatar: AvatarState) => void;
  setClientAvatar: (avatar: AvatarState) => void;
}

const DEFAULT_ADMIN_AVATAR: AvatarState = {
  type: 'initials',
  initials: 'GA',
  gradient: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
};

const DEFAULT_CLIENT_AVATAR: AvatarState = {
  type: 'initials',
  initials: 'MS',
  gradient: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
};

const UserAvatarContext = createContext<UserAvatarContextType>({
  adminAvatar: DEFAULT_ADMIN_AVATAR,
  clientAvatar: DEFAULT_CLIENT_AVATAR,
  setAdminAvatar: () => {},
  setClientAvatar: () => {},
});

export const UserAvatarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [adminAvatar, setAdminAvatarState] = useState<AvatarState>(() => {
    const saved = localStorage.getItem('bantai_admin_avatar');
    return saved ? JSON.parse(saved) : DEFAULT_ADMIN_AVATAR;
  });

  const [clientAvatar, setClientAvatarState] = useState<AvatarState>(() => {
    const saved = localStorage.getItem('bantai_client_avatar');
    return saved ? JSON.parse(saved) : DEFAULT_CLIENT_AVATAR;
  });

  const setAdminAvatar = (avatar: AvatarState) => {
    setAdminAvatarState(avatar);
    localStorage.setItem('bantai_admin_avatar', JSON.stringify(avatar));
  };

  const setClientAvatar = (avatar: AvatarState) => {
    setClientAvatarState(avatar);
    localStorage.setItem('bantai_client_avatar', JSON.stringify(avatar));
  };

  return (
    <UserAvatarContext.Provider value={{ adminAvatar, clientAvatar, setAdminAvatar, setClientAvatar }}>
      {children}
    </UserAvatarContext.Provider>
  );
};

export const useUserAvatar = () => useContext(UserAvatarContext);
