// Initialize monitoring before loading the application module tree so startup
// exceptions from providers and screens can be captured when reporting is enabled.
import './src/services/sentry';

import { registerRootComponent } from 'expo';
import * as Sentry from '@sentry/react-native';
import App from './App';

registerRootComponent(Sentry.wrap(App));
