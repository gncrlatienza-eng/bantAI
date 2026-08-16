export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

export const isValidPassword = (password: string): boolean => {
  return password.length >= 6;
};

export const isNotEmpty = (val: string): boolean => {
  return val.trim().length > 0;
};

export const validateLoginForm = (
  data: { email: string; password: string; organization?: string },
  isClient = true,
) => {
  const errors: { email?: string; password?: string; organization?: string } =
    {};

  if (isClient && (!data.organization || !isNotEmpty(data.organization))) {
    errors.organization = 'Organization name is required';
  }

  if (!isNotEmpty(data.email)) {
    errors.email = 'Email address is required';
  } else if (!isValidEmail(data.email)) {
    errors.email = 'Please enter a valid email address';
  }

  if (!isNotEmpty(data.password)) {
    errors.password = 'Password is required';
  } else if (!isValidPassword(data.password)) {
    errors.password = 'Password must be at least 6 characters';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

export const validateLicensingForm = (data: {
  organizationName: string;
  fullName: string;
  workEmail: string;
  intendedUse: string;
}) => {
  const errors: Record<string, string> = {};

  if (!isNotEmpty(data.organizationName))
    errors.organizationName = 'Organization name is required';
  if (!isNotEmpty(data.fullName)) errors.fullName = 'Full name is required';

  if (!isNotEmpty(data.workEmail)) {
    errors.workEmail = 'Work email is required';
  } else if (!isValidEmail(data.workEmail)) {
    errors.workEmail = 'Enter a valid corporate email';
  }

  if (!isNotEmpty(data.intendedUse)) {
    errors.intendedUse = 'Intended use description is required';
  } else if (data.intendedUse.length < 15) {
    errors.intendedUse =
      'Please provide a more detailed description (min 15 chars)';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};
