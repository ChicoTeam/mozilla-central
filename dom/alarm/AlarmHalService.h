/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
 
#ifndef mozilla_dom_alarm_AlarmHalService_h
#define mozilla_dom_alarm_AlarmHalService_h

#include "base/basictypes.h"
#include "mozilla/ClearOnShutdown.h"
#include "mozilla/StaticPtr.h"
#include "mozilla/Hal.h"
#include "mozilla/Services.h"
#include "nsIAlarmHalService.h"
#include "nsIObserver.h"
#include "nsIObserverService.h"
#include "prtime.h"

namespace mozilla {
namespace dom {
namespace alarm {

using namespace hal;

class AlarmHalService : public nsIAlarmHalService, 
                        public AlarmObserver,
                        public SystemTimeObserver
{
public:
  NS_DECL_ISUPPORTS
  NS_DECL_NSIALARMHALSERVICE

  void Init();
  virtual ~AlarmHalService();

  static already_AddRefed<nsIAlarmHalService> GetInstance();

  // Implementing hal::AlarmObserver
  void Notify(const mozilla::void_t& aVoid);

  // Implementing hal::SystemTimeObserver
  void Notify(const SystemTimeChange& aReason);

private:
  bool mAlarmEnabled;
  static StaticRefPtr<AlarmHalService> sSingleton;

  nsCOMPtr<nsIAlarmFiredCb> mAlarmFiredCb;
  nsCOMPtr<nsITimezoneChangedCb> mTimezoneChangedCb;

  int32_t GetTimezoneOffset(bool aIgnoreDST);
};

} // namespace alarm
} // namespace dom
} // namespace mozilla

#endif // mozilla_dom_alarm_AlarmHalService_h
