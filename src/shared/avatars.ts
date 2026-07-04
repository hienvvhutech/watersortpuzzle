/**
 * Whitelisted list of default avatars for player identities.
 * Maps avatarId to premium visual emojis.
 */
export const AVATARS: Record<string, string> = {
  avatar_1: '🦊',
  avatar_2: '🦁',
  avatar_3: '🐯',
  avatar_4: '🐼',
  avatar_5: '🐨',
  avatar_6: '🐙',
  avatar_7: '🦄',
  avatar_8: '🦅',
  avatar_9: '🐉',
  avatar_10: '🐬',
  avatar_11: '🦖',
  avatar_12: '🐈',
  avatar_13: '🐕',
  avatar_14: '🦉',
  avatar_15: '🐝',
  avatar_16: '🦋',
  avatar_17: '🐸',
  avatar_18: '🐢',
  avatar_19: '🐧',
  avatar_20: '🐒',
};

export const getAvatarEmoji = (avatarId: string | undefined | null): string => {
  if (!avatarId) return '👤';
  return AVATARS[avatarId] || '👤';
};
