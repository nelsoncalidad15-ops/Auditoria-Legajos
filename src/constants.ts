import { AuditItem, AuditItemDetail } from './types';

export const AUDIT_ITEMS: AuditItem[] = [
  {
    id: 1,
    requisito: 'Boleto fisico',
    descripcion: '6.1.1.1 / Preventa',
    roles: ['Ventas', 'Admin']
  },
  {
    id: 2,
    requisito: 'Verificar Mail',
    descripcion: '6.1.3.1 / Comparar CEM, SIAC, BOLETO, DOMINIO',
    roles: ['Ventas']
  },
  {
    id: 3,
    requisito: 'Hoja con informacion util para la operacion - Firmada por el cliente',
    descripcion: '7.1.1.1/ Explica claramente todos los pasos a seguir y documentación',
    roles: ['Ventas']
  },
  {
    id: 4,
    requisito: 'Hoja de ruta de operacion 0KM',
    descripcion: 'Registro donde se indica cada estadío administrativo',
    roles: ['Admin']
  },
  {
    id: 5,
    requisito: 'Registro de contactos con clientes',
    descripcion: '7.1.2.1 / Se registran los sucesivos contactos que se mantengan con el cliente',
    roles: ['Admin']
  },
  {
    id: 6,
    requisito: 'Mail de Bienvenida y Hoja de documentacion util',
    descripcion: 'Mail enviado desde administracion cuando se avanza con una operacion',
    roles: ['Admin']
  },
  {
    id: 7,
    requisito: 'Aviso de entregas',
    descripcion: '7.4.3.1 / Planilla de verificación para entrega de vehículo nuevo- Saleforce',
    roles: ['Ventas', 'Pre-Entrega']
  },
  {
    id: 8,
    requisito: 'Check list de pre-entrega',
    descripcion: '7.2.1.1/ Descargado del sistema Elsa Pro',
    roles: ['Pre-Entrega']
  },
  {
    id: 9,
    requisito: 'Control de campañas',
    descripcion: 'Se verifica en sistema que la unidad no cuenta con campañas',
    roles: ['Pre-Entrega']
  },
  {
    id: 10,
    requisito: 'OR Servicio - Pre-entrega',
    descripcion: 'Preparacion de la unidad, debe contar con Codigo de Radio,',
    roles: ['Pre-Entrega']
  },
  {
    id: 11,
    requisito: 'DSP',
    descripcion: 'Comprobante de servicios',
    roles: ['Pre-Entrega']
  },
  {
    id: 12,
    requisito: 'OR de instalación de accesorios - solo en caso de corresponder -',
    descripcion: '7.2.2.1 / Hoja azul',
    roles: ['Pre-Entrega']
  },
  {
    id: 13,
    requisito: 'F 01 - Check final de control de unidades a entregar',
    descripcion: '7.2.3.1/',
    roles: ['Pre-Entrega']
  },
  {
    id: 14,
    requisito: 'Confirmacion de turno de entrega 24 hs antes de la entrega',
    descripcion: '7.3.1.1',
    roles: ['Pre-Entrega']
  },
  {
    id: 15,
    requisito: 'Bitacora',
    descripcion: 'Ingreso y controles hasta la entrega',
    roles: ['Pre-Entrega']
  },
  {
    id: 16,
    requisito: 'Saleforce - Carga inicial',
    descripcion: '5.2.5.1 / Detección Necesidades',
    roles: ['Ventas']
  },
  {
    id: 17,
    requisito: 'Actividades Registradas',
    descripcion: 'Se debe dejar registro del todo el seguimiento con el cliente, es obligatorio contar con el',
    roles: ['Ventas']
  },
  {
    id: 18,
    requisito: 'Saleforce - Contacto posterior',
    descripcion: 'Seguimiento post-venta',
    roles: ['Ventas']
  },
  {
    id: 19,
    requisito: 'Gestion de reclamo',
    descripcion: 'Caso de reclamos abiertos',
    roles: ['Ventas', 'Admin']
  }
];

const normalizeRole = (role: string) => role.trim().toLowerCase();

export const getAffectedRolesForScore = (
  item: AuditItem,
  score: number | undefined,
  detail?: AuditItemDetail,
) => {
  if (score === undefined) {
    return item.roles;
  }

  const configuredRoles = (detail?.affectedRoles || []).filter((role) =>
    item.roles.some((itemRole) => normalizeRole(itemRole) === normalizeRole(role)),
  );

  return configuredRoles.length > 0 ? configuredRoles : item.roles;
};

export const calculateSummary = (
  scores: Record<number, number>,
  items: AuditItem[],
  itemDetails: Record<number, AuditItemDetail> = {},
) => {
  const getAverage = (roleFilter?: string) => {
    const answeredScores = items.flatMap((item) => {
      const score = scores[item.id];
      if (score === undefined) return [];

      if (!roleFilter) {
        return [score];
      }

      const itemHasRole = item.roles.some((role) => normalizeRole(role) === normalizeRole(roleFilter));
      if (!itemHasRole) return [];

      const affectedRoles = getAffectedRolesForScore(item, score, itemDetails[item.id]);
      const appliesToRole = affectedRoles.some((role) => normalizeRole(role) === normalizeRole(roleFilter));

      return appliesToRole ? [score] : [];
    });

    if (answeredScores.length === 0) return 0;

    return (answeredScores.reduce((a, b) => a + b, 0) / answeredScores.length) * 100;
  };

  return {
    admin: getAverage('Admin'),
    preEntrega: getAverage('Pre-Entrega'),
    ventas: getAverage('Ventas'),
    total: getAverage()
  };
};
