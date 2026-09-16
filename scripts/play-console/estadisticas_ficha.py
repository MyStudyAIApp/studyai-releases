# -*- coding: utf-8 -*-
"""Visitas e instalaciones de las fichas de Play por fuente de trafico.

Play no da estas cifras por su API: las deja en CSV mensuales en el bucket de
Cloud Storage de la cuenta (pubsite_prod_<developer id>). La cuenta de servicio
ya tiene lectura. Los CSV van con 1-2 dias de retraso.

Uso:
    python estadisticas_ficha.py            # mes actual
    python estadisticas_ficha.py 202610     # un mes concreto
"""
import sys
from datetime import date

import fichas_idiomas as fi

BUCKET = 'pubsite_prod_7493121491283010052'


def main():
    mes = sys.argv[1] if len(sys.argv) > 1 else date.today().strftime('%Y%m')
    creds = fi.service_account.Credentials.from_service_account_file(
        str(fi.CRED), scopes=['https://www.googleapis.com/auth/devstorage.read_only'])
    s = fi.build('storage', 'v1', credentials=creds, cache_discovery=False)
    for pkg in (fi.TWA, fi.SCAN):
        nombre = 'stats/store_performance/store_performance_%s_%s_traffic_source.csv' % (pkg, mes)
        try:
            d = s.objects().get_media(bucket=BUCKET, object=nombre).execute()
        except fi.HttpError if hasattr(fi, 'HttpError') else Exception as e:
            print('==== %s: sin datos para %s (%s)' % (pkg, mes, str(e)[:80]))
            continue
        print('==== %s %s' % (pkg, mes))
        print(d.decode('utf-16') if d[:2] in (b'\xff\xfe', b'\xfe\xff') else d.decode('utf-8'))


if __name__ == '__main__':
    main()
