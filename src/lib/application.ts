import { SCREEN_AUTHENTICATE } from '@Screens/screens';
import {
  Challenge,
  ChallengePrompt,
  ChallengeReason,
  ChallengeValidation,
  DeinitSource,
  Environment,
  platformFromString,
  SNApplication,
  SNComponentManager,
} from '@standardnotes/snjs';
import { Platform } from 'react-native';
import VersionInfo from 'react-native-version-info';
import { version } from '../../package.json';
import { AlertService } from './alert_service';
import { ApplicationState, UnlockTiming } from './application_state';
import { BackupsService } from './backups_service';
import { ComponentManager } from './component_manager';
import { EditorGroup } from './editor_group';
import { InstallationService } from './installation_service';
import { MobileDeviceInterface } from './interface';
import { push } from './navigation_service';
import { PreferencesManager } from './preferences_manager';
import { SNReactNativeCrypto } from './react_native_crypto';
import { ReviewService } from './review_service';
import { StatusManager } from './status_manager';

type MobileServices = {
  applicationState: ApplicationState;
  reviewService: ReviewService;
  backupsService: BackupsService;
  installationService: InstallationService;
  prefsService: PreferencesManager;
  statusManager: StatusManager;
};

const IsDev = VersionInfo.bundleIdentifier?.includes('dev');

export class MobileApplication extends SNApplication {
  private MobileServices!: MobileServices;
  public editorGroup: EditorGroup;
  private startedDeinit: boolean = false;
  public Uuid: string; // UI remounts when Uuid changes
  static previouslyLaunched: boolean = false;

  constructor(deviceInterface: MobileDeviceInterface, identifier: string) {
    super(
      Environment.Mobile,
      platformFromString(Platform.OS),
      deviceInterface,
      new SNReactNativeCrypto(),
      new AlertService(),
      identifier,
      [
        {
          swap: SNComponentManager,
          with: ComponentManager,
        },
      ],
      IsDev
        ? 'https://api-dev.standardnotes.com'
        : 'https://api.standardnotes.com',
      version,
      true,
      IsDev
        ? 'wss://sockets-dev.standardnotes.com'
        : 'wss://sockets.standardnotes.com'
    );
    this.Uuid = Math.random().toString();
    this.editorGroup = new EditorGroup(this);
    this.mobileComponentManager.initialize(this.protocolService);
  }

  get mobileComponentManager(): ComponentManager {
    return this.componentManager as ComponentManager;
  }

  static getPreviouslyLaunched() {
    return this.previouslyLaunched;
  }

  static setPreviouslyLaunched() {
    this.previouslyLaunched = true;
  }

  public hasStartedDeinit() {
    return this.startedDeinit;
  }

  /** @override */
  deinit(source: DeinitSource) {
    this.startedDeinit = true;
    for (const key of Object.keys(this.MobileServices)) {
      const service = (this.MobileServices as any)[key];
      if (service.deinit) {
        service.deinit();
      }
      service.application = undefined;
    }
    this.MobileServices = {} as MobileServices;
    this.editorGroup.deinit();
    super.deinit(source);
  }

  /** @override */
  getLaunchChallenge() {
    const challenge = super.getLaunchChallenge();

    if (!challenge) {
      return undefined;
    }

    const previouslyLaunched = MobileApplication.getPreviouslyLaunched();
    const biometricsTiming = this.getAppState().biometricsTiming;

    if (previouslyLaunched && biometricsTiming === UnlockTiming.OnQuit) {
      const filteredPrompts = challenge.prompts.filter(
        (prompt: ChallengePrompt) =>
          prompt.validation !== ChallengeValidation.Biometric
      );

      return new Challenge(
        filteredPrompts,
        ChallengeReason.ApplicationUnlock,
        false
      );
    }

    return challenge;
  }

  promptForChallenge(challenge: Challenge) {
    push(SCREEN_AUTHENTICATE, { challenge, title: challenge.modalTitle });
  }

  setMobileServices(services: MobileServices) {
    this.MobileServices = services;
  }

  public getAppState() {
    return this.MobileServices.applicationState;
  }

  public getBackupsService() {
    return this.MobileServices.backupsService;
  }

  public getLocalPreferences() {
    return this.MobileServices.prefsService;
  }

  public getStatusManager() {
    return this.MobileServices.statusManager;
  }
}
