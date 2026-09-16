# -*- coding: utf-8 -*-
"""Sustituye las capturas de telefono de las fichas de Play por idioma.

Las capturas se hacen en el movil (adb) con la app en cada idioma y se recortan a
1008x2144. La app solo esta traducida a es/en/de/fr: it/pt/nl/pl usan las de ingles.

Uso:
    python capturas_idiomas.py <carpeta_capturas>
La carpeta debe tener cap_twa_<es|en|de|fr>/ y cap_scan_<es|en|de|fr>/ con PNG
numerados (1_..., 2_...): se suben en ese orden.
"""
import sys
from pathlib import Path

from googleapiclient.http import MediaFileUpload

import fichas_idiomas as fi

IDIOMA_FICHA = {'es-ES': 'es', 'en-US': 'en', 'de-DE': 'de', 'fr-FR': 'fr',
                'it-IT': 'en', 'pt-PT': 'en', 'nl-NL': 'en', 'pl-PL': 'en'}
APPS = {fi.TWA: 'twa', fi.SCAN: 'scan'}


def main(base):
    base = Path(base)
    # Comprobar TODO antes de tocar Play
    for app in APPS.values():
        for lang in set(IDIOMA_FICHA.values()):
            fotos = sorted((base / f'cap_{app}_{lang}').glob('*.png'))
            assert 2 <= len(fotos) <= 8, f'{app} {lang}: {len(fotos)} capturas'

    creds = fi.service_account.Credentials.from_service_account_file(
        str(fi.CRED), scopes=['https://www.googleapis.com/auth/androidpublisher'])
    svc = fi.build('androidpublisher', 'v3', credentials=creds, cache_discovery=False)
    for pkg, app in APPS.items():
        eid = svc.edits().insert(packageName=pkg, body={}).execute()['id']
        for ficha, lang in IDIOMA_FICHA.items():
            svc.edits().images().deleteall(packageName=pkg, editId=eid, language=ficha,
                                           imageType='phoneScreenshots').execute()
            for foto in sorted((base / f'cap_{app}_{lang}').glob('*.png')):
                svc.edits().images().upload(packageName=pkg, editId=eid, language=ficha,
                                            imageType='phoneScreenshots',
                                            media_body=MediaFileUpload(str(foto), mimetype='image/png')).execute()
            print(f'  {pkg} {ficha}: capturas de {lang}')
        svc.edits().commit(packageName=pkg, editId=eid).execute()
        print(f'  {pkg} COMMIT ok')


if __name__ == '__main__':
    main(sys.argv[1])
