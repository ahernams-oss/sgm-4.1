// Equivalente Node/Worker do módulo deno.land/x/bcrypt usado pelas funções originais.
import bcryptjs from 'bcryptjs';

export const genSaltSync = (rounds?: number) => bcryptjs.genSaltSync(rounds ?? 10);
export const hashSync = (data: string, salt?: string | number) =>
  bcryptjs.hashSync(data, salt ?? 10);
export const compareSync = (data: string, hash: string) => bcryptjs.compareSync(data, hash);
export const hash = async (data: string, salt?: string | number) =>
  bcryptjs.hash(data, (salt as any) ?? 10);
export const compare = async (data: string, hashed: string) => bcryptjs.compare(data, hashed);

export default { genSaltSync, hashSync, compareSync, hash, compare };
