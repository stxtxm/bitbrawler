import { useCallback } from 'react';
import { supabase } from '../config/supabase';
import { Character } from '../types/Character';
import { convertFromSupabase } from '../utils/supabaseUtils';
import {
  normalizeCharacter,
  clearLocalData,
  SyncResult,
} from '../utils/persistenceUtils';

interface UseAuthDeps {
  persistCharacter: (character: Character) => Character;
  handleDbError: (error: any, context: string) => void;
  setActiveCharacter: (char: Character | null) => void;
  setDbAvailable: (available: boolean) => void;
}

export const useAuth = ({
  persistCharacter,
  handleDbError,
  setActiveCharacter,
  setDbAvailable,
}: UseAuthDeps) => {
  // Sync character with Supabase
  const syncCharacterWithSupabase = useCallback(async (character: Character): Promise<SyncResult> => {
    if (!character.id) return { status: 'missing' };

    try {
      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .eq('id', character.id)
        .single();

      if (error || !data) {
        if ((error as any)?.code === 'PGRST116') {
          return { status: 'missing' };
        }
        throw error;
      }

      const supabaseData = convertFromSupabase(data);
      setDbAvailable(true);
      return {
        status: 'ok',
        character: {
          ...supabaseData,
          id: character.id,
        },
      };
    } catch (error) {
      handleDbError(error, 'sync');
      return { status: 'error' };
    }
  }, [handleDbError, setDbAvailable]);

  // Login function
  const login = useCallback(async (name: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .eq('name', name)
        .single();

      if (error) {
        if ((error as any).code === 'PGRST116') {
          return 'Fighter not found!';
        }
        throw error;
      }

      if (!data) {
        return 'Fighter not found!';
      }

      const fullChar = normalizeCharacter({
        ...convertFromSupabase(data),
        id: data.id,
      });

      persistCharacter(fullChar);
      setDbAvailable(true);
      return null;
    } catch (error) {
      handleDbError(error, 'login');
      return 'Connection error - please check your internet connection and try again';
    }
  }, [handleDbError, persistCharacter, setDbAvailable]);

  // Logout function
  const logout = useCallback(() => {
    setActiveCharacter(null);
    clearLocalData();
  }, [setActiveCharacter]);

  // Retry connection
  const retryConnection = useCallback(async (): Promise<boolean> => {
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setDbAvailable(false);
        return false;
      }
      const { error } = await supabase
        .from('server_time')
        .select('timestamp')
        .limit(1);

      if (error) throw error;

      setDbAvailable(true);
      return true;
    } catch (error) {
      console.error('Supabase retry failed:', error);
      setDbAvailable(false);
      return false;
    }
  }, [setDbAvailable]);

  return {
    login,
    logout,
    retryConnection,
    syncCharacterWithSupabase,
  };
};
