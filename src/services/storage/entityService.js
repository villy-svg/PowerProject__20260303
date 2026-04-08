import { supabase } from '../core/supabaseClient';

/**
 * Entity Storage Service
 * 
 * This service provides a unified API for managing "Entity-Tracked" data.
 * It abstracts the logic of tiered storage (Hot vs Cold) by routing 
 * requests through Supabase Edge Functions.
 */

/**
 * Creates an entity atomically (Entity Record + Domain Record).
 * This is the standard write-path for all entity-tracked data.
 * 
 * @param {Object} params
 * @param {string} params.entityType - The slug of the entity type (e.g., 'proof_of_work')
 * @param {Object} params.domainData - The record data for the domain table (e.g., submissions)
 * @param {Object} params.metadata - Optional metadata for the entity record
 * @returns {Promise<Object>} The created entity and domain data
 */
export const createEntity = async ({ entityType, domainData = {}, metadata = {} }) => {
  if (!entityType) throw new Error('entityType is required');

  const { data, error } = await supabase.functions.invoke('entity-create', {
    body: { 
      entity_type: entityType, 
      domain_data: domainData, 
      metadata 
    },
  });

  if (error) {
    console.error('[entityService] createEntity failed:', error);
    throw new Error(error.message || 'Entity creation failed');
  }

  return data;
};

/**
 * Fetches an entity by ID via the Edge Function.
 * Transparently handles hot/cold routing — callers do not need to know the storage tier.
 * 
 * @param {string} entityId - The UUID of the entity
 * @returns {Promise<Object>} The normalized entity + domain record
 */
export const getEntity = async (entityId) => {
  if (!entityId) throw new Error('entityId is required');

  // We use native fetch for GET because supabase-js functions.invoke defaults to POST
  // and does not support query parameters natively for GET.
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  
  // Use the environment variable for the Supabase URL
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${baseUrl}/functions/v1/entity-read?id=${encodeURIComponent(entityId)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-client-info': 'supabase-js/entity-service',
    },
  });

  if (!response.ok) {
    let errBody;
    try {
      errBody = await response.json();
    } catch {
      errBody = { error: `HTTP ${response.status}` };
    }
    console.error('[entityService] getEntity failed:', errBody);
    throw new Error(errBody.error || `entity-read returned ${response.status}`);
  }

  return response.json();
};

/**
 * Lists entities by type with optional pagination.
 * 
 * NOTE: This currently uses the Supabase client directly with RLS.
 * Once the 'entity-list' Edge Function is implemented, this should be updated
 * to use the function for consistency across storage tiers.
 * 
 * @param {Object} params
 * @param {string} [params.entityType] - Optional filter by type
 * @param {number} [params.page=0]
 * @param {number} [params.pageSize=20]
 */
export const listEntities = async ({ entityType, page = 0, pageSize = 20 } = {}) => {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const query = supabase
    .from('entities')
    .select('*')
    .order('created_at', { ascending: false })
    .range(from, to);

  if (entityType) {
    query.eq('entity_type', entityType);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[entityService] listEntities failed:', error);
    throw new Error(error.message);
  }

  return data;
};
