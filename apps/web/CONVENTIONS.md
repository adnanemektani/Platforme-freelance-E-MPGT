# Conventions du frontend (apps/web)

Next.js 16 (App Router, `cacheComponents` activé), React 19, Tailwind CSS 4, TypeScript strict.
Interface **en français**, responsive, accessible. Toutes les règles métier et autorisations sont
calculées par l'API : le frontend **affiche** et **déclenche**, il ne décide jamais.

## Règles impératives

1. **Pages privées = composants client** (`'use client'` en tête de `page.tsx`). Les espaces
   (`/entreprise`, `/freelance`, `/admin`) sont déjà protégés par `SpaceShell` (layouts existants).
2. `useSearchParams()` doit être appelé dans un composant enfant enveloppé par `<Suspense>`.
   Pour l'identifiant d'une route dynamique : `const { id } = useParams<{ id: string }>()`.
3. **Aucune règle dupliquée** : les boutons d'action viennent du tableau `actions` renvoyé par l'API
   (`ActionButton`, `can()`), les éléments en attente du tableau `pending` (`PendingList`).
   Si une action est absente du tableau → ne rien afficher ; si `allowed: false` → bouton désactivé
   + motif affiché (`ActionButton` le fait).
4. **Aucun faux bouton, aucun succès simulé** : toute action appelle l'API, et seul le résultat de
   l'API met l'écran à jour (`useAction().run`). Une fonction désactivée côté serveur s'affiche avec
   son explication.
5. **Types et libellés** depuis `@empgt/contracts` : vues (`MissionView`, `ContractView`…), schémas
   d'entrée, énumérations, et `labels` (ex. `labels.missionPublication[m.publicationStatus]`).
6. **Montants** : chaînes décimales → `formatMoney(value, currency)` ; dates → `formatDate`,
   `formatDateTime`, `formatMonth` (`@/lib/format`). Jamais de `parseFloat` pour calculer.
7. **Ne pas modifier** les fichiers partagés (`src/lib/*`, `src/components/ui/*`,
   `src/components/layout/*`, `src/components/shared/*`, `src/app/layout.tsx`, `src/app/(public)/*`).
   Composants propres à un espace : `src/components/<espace>/…` (`company`, `freelancer`, `admin`).
8. Vérification avant de rendre la main :
   `cd apps/web && npx next typegen && npx tsc --noEmit -p tsconfig.json --incremental false`
   puis `npx eslint src/app/<espace> src/components/<espace>`. Ne lancez **pas** `next build` /
   `next dev` (plusieurs développeurs travaillent en parallèle).

## Briques disponibles

```ts
import { api, documentUrl, qs } from '@/lib/api';          // api.get/post/patch/put/delete/upload
import { useApi, useAction } from '@/lib/hooks';           // lecture / action serveur
import { useSession } from '@/lib/session';                // user, refresh()
import { formatDate, formatDateTime, formatMonth, formatMoney, formatNumber, firstOfMonthIso } from '@/lib/format';
import { Button, LinkButton, buttonClass } from '@/components/ui/button';
import { Field, Input, Textarea, Select, Checkbox, FormError, formValue, optionsFrom } from '@/components/ui/form';
import { Alert, EmptyState, ErrorBlock, LoadingBlock, ResourceView, Spinner } from '@/components/ui/feedback';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Card, DefinitionList, StatTile } from '@/components/ui/card';
import { DataTable, Pagination, type Column } from '@/components/ui/table';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { ActionButton, PendingList, can, findAction } from '@/components/ui/actions';
import { PageHeader, Tabs } from '@/components/ui/page';
import { FileInput } from '@/components/ui/file-upload';
import { useToast } from '@/components/ui/toast';
```

Exemple type :

```tsx
'use client';
export default function Page() {
  const { id } = useParams<{ id: string }>();
  const mission = useApi<MissionView>(`/missions/${id}`);
  return (
    <ResourceView resource={mission}>
      {(m) => (
        <>
          <PageHeader title={m.title} badge={<StatusBadge status={m.publicationStatus} label={labels.missionPublication[m.publicationStatus]} />}
            actions={<ActionButton actions={m.actions} action="submit" label="Soumettre à E-MPGT" endpoint={`/missions/${id}/submit`} success="Mission soumise" onDone={mission.setData} />} />
          <PendingList items={m.pending} />
        </>
      )}
    </ResourceView>
  );
}
```

- `ActionButton` : `reason="required" | "optional"` ouvre une boîte de dialogue de motif
  (champ envoyé : `reason`, ou `reasonField="comment"` pour accepter/refuser une proposition).
  `onDone(result)` reçoit la vue mise à jour renvoyée par l'API (souvent `resource.setData`).
- Formulaires : `<form onSubmit>` natif + `new FormData(e.currentTarget)` + `formValue(form, 'champ')`
  (chaîne vide → `null`), `useAction().run(() => api.patch(...), { success: '…' })`,
  `<FormError error={action.error} />` affiche le message et le détail des champs renvoyés par l'API.
- Fichiers : `<FileInput label kind onChange={setFile} />` puis
  `api.upload<T>(endpoint, file, { champ: valeur })` (multipart, champ « file »).
- Téléchargement : `<a href={documentUrl(doc.id)}>` (attachment) ou `documentUrl(id, true)` (aperçu PDF).
- Listes : `useApi<Page<T>>(\`/missions${qs({ page, q, status })}\`)` + `DataTable` + `Pagination`.
- Toujours prévoir : chargement (`ResourceView`), vide (`EmptyState` ou `empty` de `DataTable`),
  erreur, confirmation des actions sensibles (motif).

## API (préfixe `/api/v1`, géré par `api`)

Réponses de liste : `Page<T> = { items, total, page, pageSize }`. Requêtes : `page`, `pageSize`, `q` + filtres.

### Commun
- `GET /auth/me` · `GET /notifications` · `GET /documents` (filtres `kind`, `verificationStatus`, `profileId`, `companyId`, `contractId`, `expiringWithinDays`)
- `POST /documents` (multipart : `file`, `kind`, `target` ∈ profile|company|mission|contract|qualification|timesheet, `targetId`, `title`, `expiresAt`) · `DELETE /documents/:id` · `GET /documents/:id/download`
- `GET /skills?q=` (suggestions) · `GET /disputes` · `POST /disputes` (`OpenDisputeInput`)

### Entreprise
- `GET /company/overview` (CompanyOverview) · `GET|PATCH /company` (CompanyView) · `POST /company/submit-verification`
- `POST /company/contacts` · `PATCH|DELETE /company/contacts/:id` · `POST /company/invitations` · `DELETE /company/invitations/:id` · `DELETE /company/members/:membershipId`
- `GET /missions` · `POST /missions` (CreateMissionInput) · `GET|PATCH /missions/:id` · `POST /missions/:id/{submit,withdraw}` · `POST /missions/:id/cancel {reason}`
- `GET /applications?missionId=&status=` · `GET /applications/:id` (ApplicationView, `candidate`) · `POST /applications/:id/{shortlist,select}` · `POST /applications/:id/{reject,deselect} {reason}`
- `GET /proposals` · `GET /proposals/:id` · `POST /proposals/:id/accept {comment?}` · `POST /proposals/:id/decline {comment}`
- `GET /contracts` · `GET /contracts/:id` (ContractView) · `POST /contracts/:id/reviews {rating, comment}` · `GET /contracts/reviews?contractId=`
- `GET /timesheets?status=&contractId=` · `GET /timesheets/:id` · `POST /timesheets/:id/approve {}` · `POST /timesheets/:id/request-changes {reason}`
- `GET /company/billing` (CompanyBillingOverview) · `GET /invoices` · `GET /invoices/:id` (InvoiceView)

### Freelance
- `GET /freelancer/overview` · `GET|PATCH /profile` (OwnProfileView / UpdateProfileInput) · `POST /profile/submit` · `PUT /profile/publication {catalogVisibility, consent}`
- `PUT /profile/skills {skills}` · `PUT /profile/languages {languages}` · `POST|PATCH|DELETE /profile/{experiences,educations,qualifications,availabilities}[/:id]` · `PATCH /profile/availability-status`
- `GET /missions` (publiées ; filtres `q`, `city`, `country`, `skill`, `workMode`, `startFrom`) · `GET /missions/:id` · `POST /missions/:id/applications` (ApplyInput)
- `GET /applications` · `GET /applications/:id` · `POST /applications/:id/withdraw {reason?}`
- `GET /proposals` · `POST /proposals/:id/{accept,decline}` (`comment`)
- `GET /contracts` · `GET /contracts/:id` · `POST /contracts/:contractId/timesheets {periodStart}` (1er du mois) · `POST /contracts/:id/reviews`
- `GET /timesheets` · `GET /timesheets/:id` (TimesheetView : `allowedRange`, `checks`, `amounts`) · `PUT /timesheets/:id/entries {entries:[{date,hours,comment}], freelancerComment}` · `POST /timesheets/:id/submit` · `POST /timesheets/:id/correct {reason}` · `DELETE /timesheets/:id`
- `GET /freelancer/payments` (FreelancerPaymentsOverview) · `POST /invoices` (multipart DepositInvoiceInput + `file`, `kind=FREELANCER_INVOICE`) · `GET /invoices/:id`

### Administration (E-MPGT)
- `GET /admin/overview` · `GET /admin/users` · `POST /admin/users/:id/{suspend,reactivate} {reason}` · `POST /admin/users/:id/resend-verification`
- `GET /admin/companies?verificationStatus=&status=` · `GET|PATCH /admin/companies/:id` (PATCH avec `reason`) · `POST /admin/companies/:id/{verify,request-changes,reject,suspend,reactivate}`
- `GET /admin/freelancers?validationStatus=&origin=` · `GET|PATCH /admin/freelancers/:id` · `POST /admin/freelancers/:id/{approve,request-changes,reject,suspend,reactivate}` · `POST /admin/freelancers/:id/invite-claim {email,message}` · `POST /admin/freelancers/:id/qualifications/:qid/verify` · sections d'un profil importé non rattaché : `PUT /admin/freelancers/:id/{skills,languages}`, `POST|PATCH|DELETE /admin/freelancers/:id/{experiences,educations}[/:itemId]`
- `GET|PUT /freelancers/:profileId/payment-configuration` (UpdatePaymentConfigInput)
- `GET /missions?publicationStatus=&status=&companyId=` · `POST /missions/:id/{approve,request-changes,reject,unpublish,republish,cancel}` · `PATCH /missions/:id/admin` (avec `reason`)
- `GET /applications` · `POST /applications/:id/{shortlist,select,reject,deselect} {reason}` (motif obligatoire pour E-MPGT)
- `GET /proposals` · `POST /proposals` (CreateProposalInput) · `PATCH /proposals/:id` (ProposalTermsInput) · `POST /proposals/:id/{send,revise,approve}` · `POST /proposals/:id/withdraw {reason}`
- `GET /contracts` · `POST /contracts/:id/signed-document` (multipart `file`, `signedAt`, `signatureProofNote`) · `POST /contracts/:id/{activate,complete} {reason?}` · `POST /contracts/:id/{suspend,resume,terminate,cancel} {reason}` · `POST /contracts/:id/amendments` (CreateAmendmentInput) · `POST /amendments/:id/signed-document` (multipart) · `POST /amendments/:id/cancel {reason}`
- `GET /timesheets` · `POST /timesheets/:id/approve {reason}` (motif obligatoire : validation à la place du client) · `POST /timesheets/:id/{request-changes,correct} {reason}` · `GET /disputes` · `POST /disputes/:id/resolve {resolution, close}`
- `GET /documents` · `POST /documents/:id/verify {status: VERIFIED|REJECTED, note, expiresAt}`
- `GET /admin/finance/overview` · `GET /invoices` (filtres `kind`, `status`, `paymentState`, `overdue`) · `POST /invoices` (multipart, `kind=CLIENT_INVOICE`) · `POST /invoices/:id/{verify} {reason?}` · `POST /invoices/:id/{reject,cancel} {reason}` · `POST /invoices/:id/{payments,payouts}` (multipart `file` justificatif + RecordMoneyInput) · `POST /{payments,payouts}/:id/cancel {reason}`
- `GET /admin/imports` · `POST /admin/imports {sourceUrl}` · `POST /admin/imports/upload` (multipart `file`, `sourceUrl`) · `GET /admin/imports/:id` · `GET /admin/imports/:id/items?status=` · `POST /admin/import-items/:id/review {decision: APPROVE|IGNORE|DUPLICATE, profileId?, note?}`
- `GET|POST /admin/integration-clients` (jeton affiché une seule fois) · `POST /admin/integration-clients/:id/revoke {reason}`
- `GET /admin/contact-requests` · `POST /admin/contact-requests/:id/handled`
- `GET|PATCH /admin/settings` (UpdateSettingsInput, `reason` obligatoire) · `GET /admin/audit` (filtres `entityType`, `entityId`, `actorUserId`, `action`, `from`, `to`)
