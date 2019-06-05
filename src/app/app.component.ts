import { Component, NgZone, AfterViewInit } from '@angular/core'
import { Deeplinks } from '@ionic-native/deeplinks/ngx'
import { SplashScreen } from '@ionic-native/splash-screen/ngx'
import { StatusBar } from '@ionic-native/status-bar/ngx'
import { Platform } from '@ionic/angular'
import { TranslateService } from '@ngx-translate/core'

import { DEEPLINK_VAULT_ADD_ACCOUNT, DEEPLINK_VAULT_PREFIX } from './constants'
import { ExposedPromise, exposedPromise } from './functions/exposed-promise'
import { ErrorCategory, handleErrorLocal } from './services/error-handler/error-handler.service'
import { ProtocolsService } from './services/protocols/protocols.service'
import { SchemeRoutingService } from './services/scheme-routing/scheme-routing.service'
import { SecretsService } from './services/secrets/secrets.service'
import { StartupChecksService, Check } from './services/startup-checks/startup-checks.service'

declare let window: Window & { airGapHasStarted: boolean }

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html'
})
export class AppComponent implements AfterViewInit {
  // Sometimes the deeplink was registered before the root page was set
  // This resulted in the root page "overwriting" the deep-linked page
  public isInitialized: ExposedPromise<void> = exposedPromise<void>()

  constructor(
    private readonly platform: Platform,
    private readonly statusBar: StatusBar,
    private readonly splashScreen: SplashScreen,
    private readonly deepLinks: Deeplinks,
    private readonly startupChecks: StartupChecksService,
    private readonly schemeRoutingProvider: SchemeRoutingService,
    private readonly translate: TranslateService,
    private readonly protocolsProvider: ProtocolsService,
    private readonly secretsProvider: SecretsService,
    private readonly ngZone: NgZone
  ) {
    // We set the app as started so no "error alert" will be shown in case the app fails to load. See error-check.js for details.
    window.airGapHasStarted = true

    this.initializeApp().catch(handleErrorLocal(ErrorCategory.OTHER))
  }

  public async initializeApp(): Promise<void> {
    const supportedLanguages: string[] = ['en', 'de', 'zh-cn']
    for (const lang of supportedLanguages) {
      // We bundle languages so we don't have to load it over http
      // and we don't have to add a CSP / whitelist rule for it.
      this.translate.setTranslation(lang, require(`../assets/i18n/${lang}.json`))
      // TODO: Once we add more languages, we probably should not all languages by default
      // (we have to check if we can optimize that)
    }

    this.loadLanguages(supportedLanguages)
    this.protocolsProvider.addProtocols()

    await this.platform.ready()

    if (this.platform.is('cordova')) {
      this.statusBar.styleLightContent()
      this.statusBar.backgroundColorByHexString('#311B58')
      this.splashScreen.hide()
    }

    this.initChecks()
  }

  public loadLanguages(supportedLanguages: string[]): void {
    this.translate.setDefaultLang('en')

    const language: string = this.translate.getBrowserLang()

    if (language) {
      const lowerCaseLanguage: string = language.toLowerCase()
      supportedLanguages.forEach((supportedLanguage: string) => {
        if (supportedLanguage.startsWith(lowerCaseLanguage)) {
          this.translate.use(supportedLanguage)
        }
      })
    }
  }

  public initChecks(): void {
    this.startupChecks
      .initChecks()
      .then(async () => {
        // TODO: Use guards
        // await this.nav.setRoot(TabsPage)
        this.isInitialized.resolve()
      })
      .catch(async (check: Check) => {
        check.failureConsequence(this.initChecks.bind(this))
        this.isInitialized.reject(`startup check failed ${check.name}`) // If we are here, we cannot sign a transaction (no secret, rooted, etc)
      })
  }

  public async ngAfterViewInit(): Promise<void> {
    await this.platform.ready()
    if (this.platform.is('cordova')) {
      this.deepLinks
        .route({
          '/': undefined
        })
        .subscribe(
          match => {
            // match.$route - the route we matched, which is the matched entry from the arguments to route()
            // match.$args - the args passed in the link
            // match.$link - the full link data
            if (match && match.$link && match.$link.url) {
              this.isInitialized.promise
                .then(async () => {
                  console.log('Successfully matched route', match.$link.url)

                  if (match.$link.url === DEEPLINK_VAULT_PREFIX || match.$link.url.startsWith(DEEPLINK_VAULT_ADD_ACCOUNT)) {
                    if (this.secretsProvider.currentSecretsList.getValue().length > 0) {
                      this.ngZone.run(async () => {
                        // TODO
                        // await this.nav.popToRoot()
                        const protocol = match.$link.url.substr(DEEPLINK_VAULT_ADD_ACCOUNT.length)
                        if (protocol.length > 0) {
                          // TODO
                          // this.nav
                          //   .push(WalletSelectCoinsPage, {
                          //     protocol: protocol
                          //   })
                          //   .catch(handleErrorLocal(ErrorCategory.IONIC_NAVIGATION))
                        } else {
                          // TODO
                          // this.nav.push(WalletSelectCoinsPage).catch(handleErrorLocal(ErrorCategory.IONIC_NAVIGATION))
                        }
                      })
                    }
                  } else {
                    // TODO
                    // this.schemeRoutingProvider.handleNewSyncRequest(this.nav, match.$link.url).catch(console.error)
                  }
                })
                .catch(console.error)
            }
          },
          nomatch => {
            // nomatch.$link - the full link data
            if (nomatch && nomatch.$link && nomatch.$link.url) {
              console.error("Got a deeplink that didn't match", nomatch.$link.url)
            }
          }
        )
    }
  }
}
