/**
 * @file src/api/ghostClient.ts
 * @description Client HTTP Ghost Admin API.
 *              Configure une instance Axios avec injection automatique du JWT
 *              à chaque requête et gestion centralisée des erreurs HTTP.
 *
 * @exports getSite            — récupère les métadonnées de l'instance Ghost
 * @exports getPosts           — liste paginée des posts
 * @exports getPost            — détail complet d'un post
 * @exports createPost         — création d'un nouveau post
 * @exports updatePost         — mise à jour d'un post existant
 * @exports deletePost         — suppression d'un post
 * @exports uploadImage        — upload d'image et retour de l'URL publique
 * @exports testGhostConnection — test de connexion avec des credentials explicites (Settings)
 *
 * @security La clé API n'est jamais exposée dans ce fichier.
 *           Le JWT est généré à la volée via ghostJwt.ts à chaque requête.
 *           Aucun appel réseau en HTTP plain — HTTPS uniquement.
 */

import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
} from 'axios';

import { generateGhostJwt } from './ghostJwt';
import {
  GhostPost,
  GhostSite,
  GhostPostsResponse,
  CreatePostPayload,
  UpdatePostPayload,
  PostFilter,
  GhostImageUploadResponse,
  AuthenticationError,
  ConflictError,
  ValidationError,
  RateLimitError,
  GhostApiError,
  NotConfiguredError,
} from './ghostTypes';

// ---------------------------------------------------------------------------
// Instance Axios principale
// ---------------------------------------------------------------------------

const client: AxiosInstance = axios.create({
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// ---------------------------------------------------------------------------
// Intercepteur de requête — injection du JWT et de la baseURL
// ---------------------------------------------------------------------------

client.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  // Import paresseux pour éviter la dépendance circulaire au niveau du module
  const { useInstanceStore } = await import('../store/instanceStore');
  const state = useInstanceStore.getState();
  const activeInstance = state.instances.find((i) => i.id === state.activeInstanceId) ?? null;

  if (!activeInstance) {
    throw new NotConfiguredError();
  }

  config.baseURL = activeInstance.url;
  const token = generateGhostJwt(activeInstance.apiKey);
  config.headers.set('Authorization', `Ghost ${token}`);

  return config;
});

// ---------------------------------------------------------------------------
// Intercepteur de réponse — normalisation des erreurs HTTP
// ---------------------------------------------------------------------------

client.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status ?? 0;
    const data = error.response?.data as { errors?: Array<{ message: string }> } | undefined;
    const message = data?.errors?.[0]?.message ?? error.message;

    switch (status) {
      case 401:
        throw new AuthenticationError(status, message);
      case 409:
        throw new ConflictError(status, message);
      case 422:
        throw new ValidationError(status, message);
      case 429:
        throw new RateLimitError(status, message);
      default:
        throw new GhostApiError(status, message);
    }
  },
);

// ---------------------------------------------------------------------------
// Fonctions API exportées
// ---------------------------------------------------------------------------

/**
 * Récupère les métadonnées du site Ghost.
 * Utilisé pour valider la connexion lors de l'ajout d'une instance.
 */
export async function getSite(): Promise<GhostSite> {
  const response = await client.get<{ site: GhostSite }>('/ghost/api/admin/site/');
  return response.data.site;
}

/**
 * Récupère une page de posts avec filtre optionnel.
 * Inclut les tags dans la réponse pour éviter un aller-retour supplémentaire à l'édition.
 *
 * @param page   - Numéro de page (commence à 1)
 * @param filter - Filtre de statut : 'all' | 'draft' | 'published'
 */
export async function getPosts(page: number, filter?: PostFilter): Promise<GhostPostsResponse> {
  const statusFilter =
    !filter || filter === 'all' ? 'status:[draft,published]' : `status:${filter}`;

  const response = await client.get<GhostPostsResponse>('/ghost/api/admin/posts/', {
    params: {
      page,
      limit: 15,
      filter: statusFilter,
      include: 'tags',
      formats: 'html',
      order: 'updated_at desc',
    },
  });
  return response.data;
}

/**
 * Récupère le contenu complet d'un post, incluant le HTML et les tags.
 *
 * @param id - Identifiant Ghost du post
 */
export async function getPost(id: string): Promise<GhostPost> {
  const response = await client.get<{ posts: GhostPost[] }>(`/ghost/api/admin/posts/${id}/`, {
    params: { include: 'tags' },
  });
  return response.data.posts[0];
}

/**
 * Crée un nouveau post.
 *
 * @param payload - Titre, contenu HTML, statut et tags
 * @returns Le post créé avec son identifiant Ghost
 */
export async function createPost(payload: CreatePostPayload): Promise<GhostPost> {
  const response = await client.post<{ posts: GhostPost[] }>(
    '/ghost/api/admin/posts/?source=html',
    payload,
  );
  return response.data.posts[0];
}

/**
 * Met à jour un post existant.
 * Le champ `updated_at` est obligatoire dans le payload (optimistic lock Ghost).
 * Une valeur périmée déclenche une 409 ConflictError.
 *
 * @param id      - Identifiant Ghost du post
 * @param payload - Nouvelles valeurs + updated_at original
 * @returns Le post mis à jour
 */
export async function updatePost(id: string, payload: UpdatePostPayload): Promise<GhostPost> {
  const response = await client.put<{ posts: GhostPost[] }>(
    `/ghost/api/admin/posts/${id}/?source=html`,
    payload,
  );
  return response.data.posts[0];
}

/**
 * Supprime définitivement un post.
 *
 * @param id - Identifiant Ghost du post
 */
export async function deletePost(id: string): Promise<void> {
  await client.delete(`/ghost/api/admin/posts/${id}/`);
}

/**
 * Upload une image depuis la galerie locale vers Ghost et retourne l'URL publique.
 * L'URL retournée est directement utilisable dans la syntaxe Markdown `![alt](url)`.
 *
 * @param localUri - URI locale de l'image (fourni par expo-image-picker)
 * @returns URL publique Ghost de l'image uploadée
 */
export async function uploadImage(localUri: string): Promise<string> {
  const filename = localUri.split('/').pop() ?? 'image.jpg';
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  const MIME_MAP: Record<string, string> = {
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    heic: 'image/heic',
    heif: 'image/heif',
  };
  const type = MIME_MAP[ext] ?? 'image/jpeg';

  const formData = new FormData();
  // React Native utilise un objet {uri, name, type} là où Web attend un Blob
  formData.append('file', { uri: localUri, name: filename, type } as unknown as Blob);
  formData.append('purpose', 'image');

  // Ne pas forcer Content-Type — React Native XMLHttpRequest ajoute le boundary automatiquement.
  // Avec Axios 1.x + Hermes, forcer 'multipart/form-data' sans boundary fait échouer le parse côté serveur.
  const response = await client.post<GhostImageUploadResponse>(
    '/ghost/api/admin/images/upload/',
    formData,
    // null supprime explicitement le Content-Type par défaut (application/json)
    // pour laisser React Native XHR injecter le boundary multipart automatiquement.
    { headers: { 'Content-Type': null } },
  );
  return response.data.images[0].url;
}

/**
 * Teste la connectivité et l'authenticité d'une instance Ghost avec des credentials explicites.
 * Utilisé depuis l'écran Settings avant d'enregistrer une nouvelle instance.
 * Contourne les intercepteurs pour éviter de dépendre d'une instance déjà configurée.
 *
 * @param baseUrl - URL de base de l'instance Ghost (ex: https://ghost.example.fr)
 * @param apiKey  - Clé Admin API au format id:secret
 * @returns Métadonnées du site si la connexion réussit
 * @throws GhostApiError avec le message approprié si la connexion échoue
 */
export async function testGhostConnection(baseUrl: string, apiKey: string): Promise<GhostSite> {
  const token = generateGhostJwt(apiKey);
  const response = await axios.get<{ site: GhostSite }>(`${baseUrl}/ghost/api/admin/site/`, {
    headers: {
      Authorization: `Ghost ${token}`,
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  });
  return response.data.site;
}
