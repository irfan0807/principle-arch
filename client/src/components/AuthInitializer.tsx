import { useEffect } from 'react';
import { useAppDispatch } from '../store/hooks';
import { fetchUser } from '../store/slices/authSlice';

export function AuthInitializer() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(fetchUser());
  }, [dispatch]);

  return null;
}