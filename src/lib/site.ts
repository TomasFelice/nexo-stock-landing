const number = import.meta.env.PUBLIC_WHATSAPP_NUMBER || '5491144132706';
if (!/^549\d{10}$/.test(number))
  throw new Error('PUBLIC_WHATSAPP_NUMBER debe usar el formato 549 + 10 dígitos.');
export const offer = {
  monthly: 39,
  setup: 99,
  physicalLocations: 3,
  whatsappNumber: number,
  message:
    'Hola, quiero coordinar una demo de 15 minutos de NexoStock para mi marca. Uso Tiendanube y me interesa ordenar el stock de mi local.',
} as const;
export const whatsappUrl = `https://wa.me/${number}?text=${encodeURIComponent(offer.message)}`;
export const siteUrl = 'https://www.nexostock.benai.com.ar';
