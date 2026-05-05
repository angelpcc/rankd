import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Brand, BrandProduct, BrandService } from '@/lib/supabase';

export interface BrandWithItems extends Brand {
  products: BrandProduct[];
  services: BrandService[];
}

export function useBrands() {
  const [brands, setBrands] = useState<BrandWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBrands = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: brandsData, error: brandsError } = await supabase
        .from('brands')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (brandsError) throw brandsError;
      if (!brandsData || brandsData.length === 0) {
        setBrands([]);
        setLoading(false);
        return;
      }

      const userIds = brandsData.map((b) => b.user_id).filter(Boolean);
      let productsMap: Record<string, BrandProduct[]> = {};
      let servicesMap: Record<string, BrandService[]> = {};

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, user_type')
          .in('id', userIds)
          .eq('user_type', 'brand');

        if (profilesData && profilesData.length > 0) {
          const profileIds = profilesData.map((p) => p.id);

          const [{ data: productsData }, { data: servicesData }] = await Promise.all([
            supabase
              .from('brand_products')
              .select('*')
              .in('brand_profile_id', profileIds)
              .order('created_at', { ascending: false }),
            supabase
              .from('brand_services')
              .select('*')
              .in('brand_profile_id', profileIds)
              .order('created_at', { ascending: false }),
          ]);

          if (productsData) {
            productsData.forEach((p) => {
              if (!productsMap[p.brand_profile_id]) productsMap[p.brand_profile_id] = [];
              productsMap[p.brand_profile_id].push(p);
            });
          }
          if (servicesData) {
            servicesData.forEach((s) => {
              if (!servicesMap[s.brand_profile_id]) servicesMap[s.brand_profile_id] = [];
              servicesMap[s.brand_profile_id].push(s);
            });
          }
        }
      }

      const combined: BrandWithItems[] = brandsData.map((brand) => ({
        ...brand,
        products: productsMap[brand.user_id] || [],
        services: servicesMap[brand.user_id] || [],
      }));

      setBrands(combined);
    } catch (err) {
      setError('Error al cargar las marcas');
      setBrands([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  return { brands, loading, error, refetch: fetchBrands };
}
