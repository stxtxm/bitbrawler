import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';

export const ROUTER_FUTURE_FLAGS = {
  v7_startTransition: true,
  v7_relativeSplatPath: true
} as const;

type RouterRenderOptions = Omit<RenderOptions, 'wrapper'> & {
  initialEntries?: string[];
};

export const renderWithRouter = (
  ui: ReactElement,
  { initialEntries = ['/'], ...renderOptions }: RouterRenderOptions = {}
) => {
  return render(
    <MemoryRouter initialEntries={initialEntries} future={ROUTER_FUTURE_FLAGS}>
      {ui}
    </MemoryRouter>,
    renderOptions
  );
};
