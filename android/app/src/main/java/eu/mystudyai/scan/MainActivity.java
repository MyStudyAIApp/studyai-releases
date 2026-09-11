package eu.mystudyai.scan;

import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;
import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.UpdateAvailability;

/**
 * Aviso de actualizacion al abrir la app (Play In-App Updates).
 *
 * Por que hace falta: esta app lleva la web DENTRO del paquete (webDir 'dist'),
 * no la carga de internet. Una version vieja no es solo "vieja": le faltan
 * funciones y puede hablar con el backend de otra manera. Antes el alumno solo
 * se enteraba si entraba a Play Store por su cuenta.
 *
 * Es el flujo IMMEDIATE a proposito: Play ensena una pantalla completa y se
 * encarga de descargar e instalar. El flujo flexible (descargar por detras y
 * avisar) obliga a escuchar el progreso y a pintar un aviso propio, y dejaria
 * al alumno semanas con la version vieja.
 *
 * ⚠️ Tres cosas que conviene recordar antes de probarlo:
 *  1. Solo funciona si la app se INSTALO desde Play Store. Un APK de
 *     depuracion instalado por cable nunca va a ver ninguna actualizacion.
 *  2. Solo compara con lo que hay PUBLICADO en Play. Para probarlo hay que
 *     subir a pista interna o usar "Compartir apps internamente".
 *  3. Empieza a funcionar desde la SIGUIENTE version publicada: quien tenga
 *     instalada una anterior a esta tiene que actualizar a mano una vez.
 *
 * Si algo falla (sin Play Services, sin red, instalada de otro sitio) se
 * registra y se sigue. Un fallo comprobando la actualizacion NO puede impedir
 * que la app arranque.
 */
public class MainActivity extends BridgeActivity {

    private static final String TAG = "Actualizacion";
    private static final int RC_ACTUALIZAR = 1610;

    private AppUpdateManager gestorActualizacion;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        gestorActualizacion = AppUpdateManagerFactory.create(this);
        gestorActualizacion.getAppUpdateInfo()
            .addOnSuccessListener(info -> {
                if (info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
                        && info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) {
                    lanzar(info);
                }
            })
            .addOnFailureListener(e -> Log.w(TAG, "no se pudo comprobar: " + e.getMessage()));
    }

    @Override
    public void onResume() {
        super.onResume();
        // Si la instalacion se quedo a medias (el alumno salio de la app en
        // mitad de la descarga), Play la retoma al volver. Sin esto se queda
        // en un limbo del que solo se sale entrando a Play Store a mano.
        if (gestorActualizacion == null) return;
        gestorActualizacion.getAppUpdateInfo().addOnSuccessListener(info -> {
            if (info.updateAvailability()
                    == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS) {
                lanzar(info);
            }
        });
    }

    private void lanzar(AppUpdateInfo info) {
        try {
            gestorActualizacion.startUpdateFlowForResult(
                info, this,
                AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build(),
                RC_ACTUALIZAR);
        } catch (Exception e) {
            Log.w(TAG, "no se pudo lanzar: " + e.getMessage());
        }
    }
}
