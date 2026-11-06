import React from 'react';

interface IconButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'className'
> {
  ariaLabel: string;
  outlined?: boolean;
  children: React.ReactNode;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { ariaLabel, outlined = false, type = 'button', children, ...rest },
    ref,
  ) {
    const classes = `bantai-p-iconbtn${
      outlined ? ' bantai-p-iconbtn--outlined' : ''
    }`;
    return (
      <button
        ref={ref}
        type={type}
        aria-label={ariaLabel}
        className={classes}
        {...rest}
      >
        <span aria-hidden>{children}</span>
      </button>
    );
  },
);
